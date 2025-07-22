import { Instruction, Operand, OperandType, Byte, Word, DWord } from "./types";
import { MMU } from "./MMU";

/**
 * Instruction Decoder
 * Decodes x86-like bytecode into executable instructions
 */
export class InstructionDecoder {
	private mmu: MMU;

	// ModR/M byte fields
	private static readonly MOD_MASK = 0xc0;
	private static readonly REG_MASK = 0x38;
	private static readonly RM_MASK = 0x07;

	// Register mapping
	private static readonly REGISTERS_8 = ["AL", "CL", "DL", "BL", "AH", "CH", "DH", "BH"];
	private static readonly REGISTERS_16 = ["AX", "CX", "DX", "BX", "SP", "BP", "SI", "DI"];
	private static readonly REGISTERS_32 = ["EAX", "ECX", "EDX", "EBX", "ESP", "EBP", "ESI", "EDI"];

	constructor(mmu: MMU) {
		this.mmu = mmu;
	}

	/**
	 * Decode instruction at given address
	 */
	decodeInstruction(address: DWord): Instruction {
		let currentAddress = address;
		const opcode = this.mmu.readByte(currentAddress++);

		switch (opcode) {
			case 0x0f: {
				const secondByte = this.mmu.readByte(currentAddress);
				currentAddress++;

				switch (secondByte) {
					case 0x31: // RDTSC
						return {
							opcode: 0x0f31,
							operands: [],
							size: 2,
							mnemonic: "RDTSC",
						};
					case 0xc7: // RDRAND/RDSEED group
						return this.decodeRDRAND(currentAddress, secondByte);
					case 0xaf: // IMUL r32, r/m32
						return this.decodeIMUL2(currentAddress - 1, secondByte);
					case 0x8c: {
						// JL rel32 (32-bit relative jump)
						const offset32 = this.mmu.readDWord(currentAddress);
						return {
							opcode: 0x0f8c,
							operands: [
								{
									type: OperandType.IMMEDIATE,
									value: offset32,
									size: 4,
								},
							],
							size: 6,
							mnemonic: "JL",
						};
					}
					default:
						throw `Invalid two-byte opcode: 0x0F ${string.format("%X", secondByte)}`;
				}
			}

			// MOV instructions
			case 0x88: // MOV r/m8, r8
				return this.decodeMOV(currentAddress, opcode, 1);
			case 0x89: // MOV r/m32, r32
				return this.decodeMOV(currentAddress, opcode, 4);
			case 0xa3: // MOV [imm32], EAX
				return this.decodeMOVToMemory(currentAddress, opcode, 4, 0);
			case 0x63: // MOVSXD r32, r/m32 (Move with sign extension)
				return this.decodeMOVSXD(currentAddress, opcode);
			case 0xb0:
			case 0xb1:
			case 0xb2:
			case 0xb3: // MOV r8, imm8
			case 0xb4:
			case 0xb5:
			case 0xb6:
			case 0xb7:
				return this.decodeMOVImmediate(currentAddress, opcode, 1);
			case 0xb8:
			case 0xb9:
			case 0xba:
			case 0xbb: // MOV r32, imm32
			case 0xbc:
			case 0xbd:
			case 0xbe:
			case 0xbf:
				return this.decodeMOVImmediate(currentAddress, opcode, 4);

			// Arithmetic instructions
			case 0x00: // ADD r/m8, r8
				return this.decodeALU(currentAddress, opcode, "ADD", 1);
			case 0x01: // ADD r/m32, r32
				return this.decodeALU(currentAddress, opcode, "ADD", 4);
			case 0x02: // ADD r8, r/m8
				return this.decodeALUReversed(currentAddress, opcode, "ADD", 1);
			case 0x03: // ADD r32, r/m32
				return this.decodeALUReversed(currentAddress, opcode, "ADD", 4);
			case 0x28: // SUB r/m8, r8
				return this.decodeALU(currentAddress, opcode, "SUB", 1);
			case 0x29: // SUB r/m32, r32
				return this.decodeALU(currentAddress, opcode, "SUB", 4);
			case 0xf7: // Group 3: NOT, NEG, MUL, IMUL, DIV, IDIV
				return this.decodeGroup3(currentAddress, opcode);

			// INC/DEC instructions
			case 0x40:
			case 0x41:
			case 0x42:
			case 0x43: // INC r32
			case 0x44:
			case 0x45:
			case 0x46:
			case 0x47:
				return this.decodeINCDEC(currentAddress, opcode, "INC");
			case 0x48:
			case 0x49:
			case 0x4a:
			case 0x4b: // DEC r32
			case 0x4c:
			case 0x4d:
			case 0x4e:
			case 0x4f:
				return this.decodeINCDEC(currentAddress, opcode, "DEC");

			// Logical instructions
			case 0x20: // AND r/m8, r8
				return this.decodeALU(currentAddress, opcode, "AND", 1);
			case 0x21: // AND r/m32, r32
				return this.decodeALU(currentAddress, opcode, "AND", 4);
			case 0x25: // AND EAX, imm32
				return this.decodeALUImmediate(currentAddress, opcode, "AND", 4, 0);
			case 0x08: // OR r/m8, r8
				return this.decodeALU(currentAddress, opcode, "OR", 1);
			case 0x09: // OR r/m32, r32
				return this.decodeALU(currentAddress, opcode, "OR", 4);
			case 0x30: // XOR r/m8, r8
				return this.decodeALU(currentAddress, opcode, "XOR", 1);
			case 0x31: // XOR r/m32, r32
				return this.decodeALU(currentAddress, opcode, "XOR", 4);
			case 0x35: // XOR EAX, imm32
				return this.decodeALUImmediate(currentAddress, opcode, "XOR", 4, 0);

			// Bit shift instructions
			case 0xd1: // SHL/SHR r/m32, 1
				return this.decodeBitShift(currentAddress, opcode, 4);
			case 0xc1: // SHL/SHR r/m32, imm8
				return this.decodeBitShiftImm(currentAddress, opcode, 4);

			// Group instructions
			case 0x81: // Multiple ALU operations with imm32
				return this.decodeALUGroup(currentAddress, opcode, 4);
			case 0x83: // ADD/SUB/AND/OR/XOR r/m32, imm8
				return this.decodeALUGroup8(currentAddress, opcode, 4);

			// TEST instruction
			case 0x85: // TEST r/m32, r32
				return this.decodeALU(currentAddress, opcode, "TEST", 4);

			// XCHG instruction
			case 0x87: // XCHG r/m32, r32
				return this.decodeALU(currentAddress, opcode, "XCHG", 4);

			// Jump instructions
			case 0xe9: // JMP rel32
				return this.decodeJMP(currentAddress, opcode);
			case 0xeb: // JMP rel8
				return this.decodeConditionalJump(currentAddress, opcode, "JMP");
			case 0x70: // JO rel8 (Jump if Overflow)
				return this.decodeConditionalJump(currentAddress, opcode, "JO");
			case 0x71: // JNO rel8 (Jump if Not Overflow)
				return this.decodeConditionalJump(currentAddress, opcode, "JNO");
			case 0x72: // JB/JC rel8 (Jump if Below/Carry)
				return this.decodeConditionalJump(currentAddress, opcode, "JC");
			case 0x73: // JAE/JNC rel8 (Jump if Above or Equal/Not Carry)
				return this.decodeConditionalJump(currentAddress, opcode, "JNC");
			case 0x74: // JE/JZ rel8 (Jump if Equal/Zero)
				return this.decodeConditionalJump(currentAddress, opcode, "JZ");
			case 0x75: // JNE/JNZ rel8 (Jump if Not Equal/Not Zero)
				return this.decodeConditionalJump(currentAddress, opcode, "JNZ");
			case 0x76: // JBE/JNA rel8 (Jump if Below or Equal/Not Above)
				return this.decodeConditionalJump(currentAddress, opcode, "JBE");
			case 0x77: // JA/JNBE rel8 (Jump if Above/Not Below or Equal)
				return this.decodeConditionalJump(currentAddress, opcode, "JA");
			case 0x78: // JS rel8 (Jump if Sign)
				return this.decodeConditionalJump(currentAddress, opcode, "JS");
			case 0x79: // JNS rel8 (Jump if Not Sign)
				return this.decodeConditionalJump(currentAddress, opcode, "JNS");
			case 0x7a: // JP/JPE rel8 (Jump if Parity/Parity Even)
				return this.decodeConditionalJump(currentAddress, opcode, "JP");
			case 0x7b: // JNP/JPO rel8 (Jump if Not Parity/Parity Odd)
				return this.decodeConditionalJump(currentAddress, opcode, "JNP");
			case 0x7c: // JL/JNGE rel8 (Jump if Less/Not Greater or Equal)
				return this.decodeConditionalJump(currentAddress, opcode, "JL");
			case 0x7d: // JGE/JNL rel8 (Jump if Greater or Equal/Not Less)
				return this.decodeConditionalJump(currentAddress, opcode, "JGE");
			case 0x7e: // JLE/JNG rel8 (Jump if Less or Equal/Not Greater)
				return this.decodeConditionalJump(currentAddress, opcode, "JLE");
			case 0x7f: // JG/JNLE rel8 (Jump if Greater/Not Less or Equal)
				return this.decodeConditionalJump(currentAddress, opcode, "JG");

			// Stack instructions
			case 0x50:
			case 0x51:
			case 0x52:
			case 0x53: // PUSH r32
			case 0x54:
			case 0x55:
			case 0x56:
			case 0x57:
				return this.decodePUSHPOP(currentAddress, opcode, "PUSH");
			case 0x58:
			case 0x59:
			case 0x5a:
			case 0x5b: // POP r32
			case 0x5c:
			case 0x5d:
			case 0x5e:
			case 0x5f:
				return this.decodePUSHPOP(currentAddress, opcode, "POP");

			// CALL/RET instructions
			case 0xe8: // CALL rel32
				return this.decodeCALL(currentAddress, opcode);
			case 0xc3: // RET
				return this.decodeRET(currentAddress, opcode);

			// CMP instruction
			case 0x38: // CMP r/m8, r8
				return this.decodeALU(currentAddress, opcode, "CMP", 1);
			case 0x39: // CMP r/m32, r32
				return this.decodeALU(currentAddress, opcode, "CMP", 4);
			case 0x3d: // CMP EAX, imm32
				return this.decodeALUImmediate(currentAddress, opcode, "CMP", 4, 0);

			// System instructions
			case 0x90: // NOP
				return {
					opcode: opcode,
					operands: [],
					size: 1,
					mnemonic: "NOP",
				};
			case 0xf4: // HLT
				return {
					opcode: opcode,
					operands: [],
					size: 1,
					mnemonic: "HLT",
				};
			case 0x9c: // PUSHF
				return {
					opcode: opcode,
					operands: [],
					size: 1,
					mnemonic: "PUSHF",
				};
			case 0x9d: // POPF
				return {
					opcode: opcode,
					operands: [],
					size: 1,
					mnemonic: "POPF",
				};
			case 0xfd: // STD (Set Direction Flag)
				return {
					opcode: opcode,
					operands: [],
					size: 1,
					mnemonic: "STD",
				};
			case 0xfb: // STI (Set Interrupt Flag)
				return {
					opcode: opcode,
					operands: [],
					size: 1,
					mnemonic: "STI",
				};
			case 0xfc: // CLD (Clear Direction Flag)
				return {
					opcode: opcode,
					operands: [],
					size: 1,
					mnemonic: "CLD",
				};
			case 0xfa: // CLI (Clear Interrupt Flag)
				return {
					opcode: opcode,
					operands: [],
					size: 1,
					mnemonic: "CLI",
				};
			case 0xcd: // INT imm8
				return this.decodeINT(currentAddress, opcode);

			default:
				throw `Invalid opcode: 0x${string.format("%X", opcode)}`;
		}
	}

	/**
	 * Decode RDRAND/RDSEED instructions
	 */
	private decodeRDRAND(address: DWord, opcode: Byte): Instruction {
		const modRM = this.mmu.readByte(address);
		const reg = (modRM & 0x38) >> 3;

		if (reg === 6) {
			// RDRAND
			const [operand, , instrSize] = this.decodeModRM(address, 4);
			return {
				opcode: 0x0fc7,
				operands: [operand],
				size: instrSize + 2,
				mnemonic: "RDRAND",
			};
		} else if (reg === 7) {
			// RDSEED
			const [operand, , instrSize] = this.decodeModRM(address, 4);
			return {
				opcode: 0x0fc7,
				operands: [operand],
				size: instrSize + 2,
				mnemonic: "RDSEED",
			};
		}

		throw "Invalid RDRAND/RDSEED instruction";
	}

	/**
	 * Decode IMUL with two operands (0x0F 0xAF)
	 */
	private decodeIMUL2(address: DWord, opcode: Byte): Instruction {
		const [operand1, operand2, instrSize] = this.decodeModRM(address + 1, 4); // +1 to skip the 0xAF byte
		return {
			opcode: 0x0faf,
			operands: [operand2, operand1], // dest, src (reg gets result)
			size: instrSize + 2, // +2 for 0x0F 0xAF
			mnemonic: "IMUL2",
		};
	}

	/**
	 * Decode MOV instruction
	 */
	private decodeMOV(address: DWord, opcode: Byte, size: number): Instruction {
		const modRM = this.mmu.readByte(address);
		const [operand1, operand2, instrSize] = this.decodeModRM(address, size);
		return {
			opcode: opcode,
			operands: [operand1, operand2],
			size: instrSize + 1,
			mnemonic: "MOV",
		};
	}

	/**
	 * Decode MOV with immediate value
	 */
	private decodeMOVImmediate(address: DWord, opcode: Byte, size: number): Instruction {
		const regIndex = opcode & 0x07;
		const register =
			size === 1 ? InstructionDecoder.REGISTERS_8[regIndex] : InstructionDecoder.REGISTERS_32[regIndex];
		const immediate = size === 1 ? this.mmu.readByte(address) : this.mmu.readDWord(address);

		return {
			opcode: opcode,
			operands: [
				{
					type: OperandType.REGISTER,
					value: regIndex,
					size: size,
					register: register,
				},
				{
					type: OperandType.IMMEDIATE,
					value: immediate,
					size: size,
				},
			],
			size: 1 + size,
			mnemonic: "MOV",
		};
	}

	/**
	 * Decode MOVSXD instruction
	 */
	private decodeMOVSXD(address: DWord, opcode: Byte): Instruction {
		const [operand1, operand2, instrSize] = this.decodeModRM(address, 4);
		return {
			opcode: opcode,
			operands: [operand2, operand1], // destination, source
			size: instrSize + 1,
			mnemonic: "MOVSXD",
		};
	}

	/**
	 * Decode MOV to memory with direct addressing
	 */
	private decodeMOVToMemory(address: DWord, opcode: Byte, size: number, regIndex: number): Instruction {
		const memoryAddress = this.mmu.readDWord(address);
		const registerNames = size === 1 ? InstructionDecoder.REGISTERS_8 : InstructionDecoder.REGISTERS_32;

		return {
			opcode: opcode,
			operands: [
				{
					type: OperandType.MEMORY,
					value: memoryAddress,
					size: size,
				},
				{
					type: OperandType.REGISTER,
					value: regIndex,
					size: size,
					register: registerNames[regIndex],
				},
			],
			size: 5,
			mnemonic: "MOV",
		};
	}

	/**
	 * Decode ALU instructions (ADD, SUB, AND, OR, XOR, CMP, TEST, XCHG)
	 */
	private decodeALU(address: DWord, opcode: Byte, mnemonic: string, size: number): Instruction {
		const modRM = this.mmu.readByte(address);
		const [operand1, operand2, instrSize] = this.decodeModRM(address, size);
		return {
			opcode: opcode,
			operands: [operand1, operand2],
			size: instrSize + 1,
			mnemonic: mnemonic,
		};
	}

	/**
	 * Decode Group 3 instructions (0xF7)
	 */
	private decodeGroup3(address: DWord, opcode: Byte): Instruction {
		const modRM = this.mmu.readByte(address);
		const reg = (modRM & InstructionDecoder.REG_MASK) >> 3;

		const operations = ["TEST", "TEST", "NOT", "NEG", "MUL", "IMUL", "DIV", "IDIV"];
		const operation = operations[reg];

		const [operand1, , instrSize] = this.decodeModRM(address, 4);

		if (reg === 0 || reg === 1) {
			// TEST with immediate
			const immediate = this.mmu.readDWord(address + instrSize);
			return {
				opcode: opcode,
				operands: [
					operand1,
					{
						type: OperandType.IMMEDIATE,
						value: immediate,
						size: 4,
					},
				],
				size: instrSize + 5,
				mnemonic: "TEST",
			};
		} else {
			return {
				opcode: opcode,
				operands: [operand1],
				size: instrSize + 1,
				mnemonic: operation,
			};
		}
	}

	/**
	 * Decode ALU instruction with reversed operand order (reg = destination)
	 */
	private decodeALUReversed(address: DWord, opcode: Byte, mnemonic: string, size: number): Instruction {
		const [operand1, operand2, instrSize] = this.decodeModRM(address, size);
		// reverse the operands - register is destination, r/m is source
		return {
			opcode: opcode,
			operands: [operand2, operand1], // operand2 is the register, operand1 is r/m
			size: instrSize + 1,
			mnemonic: mnemonic,
		};
	}

	/**
	 * Decode ALU instruction with immediate (EAX variants)
	 */
	private decodeALUImmediate(
		address: DWord,
		opcode: Byte,
		mnemonic: string,
		size: number,
		regIndex: number,
	): Instruction {
		const immediate = size === 1 ? this.mmu.readByte(address) : this.mmu.readDWord(address);
		const registerNames = size === 1 ? InstructionDecoder.REGISTERS_8 : InstructionDecoder.REGISTERS_32;

		return {
			opcode: opcode,
			operands: [
				{
					type: OperandType.REGISTER,
					value: regIndex,
					size: size,
					register: registerNames[regIndex],
				},
				{
					type: OperandType.IMMEDIATE,
					value: immediate,
					size: size,
				},
			],
			size: 1 + size,
			mnemonic: mnemonic,
		};
	}

	/**
	 * Decode ALU group instructions (0x81 - uses ModR/M reg field for operation)
	 */
	private decodeALUGroup(address: DWord, opcode: Byte, size: number): Instruction {
		const modRM = this.mmu.readByte(address);
		const reg = (modRM & InstructionDecoder.REG_MASK) >> 3;

		const operations = ["ADD", "OR", "ADC", "SBB", "AND", "SUB", "XOR", "CMP"];
		const operation = operations[reg];

		const [operand1, , instrSize] = this.decodeModRM(address, size);
		const immediate = this.mmu.readDWord(address + instrSize);

		return {
			opcode: opcode,
			operands: [
				operand1,
				{
					type: OperandType.IMMEDIATE,
					value: immediate,
					size: 4,
				},
			],
			size: instrSize + 5,
			mnemonic: operation,
		};
	}

	/**
	 * Decode ALU group with 8-bit immediate (0x83)
	 */
	private decodeALUGroup8(address: DWord, opcode: Byte, size: number): Instruction {
		const modRM = this.mmu.readByte(address);
		const reg = (modRM & InstructionDecoder.REG_MASK) >> 3;

		const operations = ["ADD", "OR", "ADC", "SBB", "AND", "SUB", "XOR", "CMP"];
		const operation = operations[reg];

		const [operand1, , instrSize] = this.decodeModRM(address, size);
		const immediate = this.mmu.readByte(address + instrSize);

		return {
			opcode: opcode,
			operands: [
				operand1,
				{
					type: OperandType.IMMEDIATE,
					value: immediate,
					size: 1,
				},
			],
			size: instrSize + 2,
			mnemonic: operation,
		};
	}

	/**
	 * Decode bit shift instructions (SHL/SHR with count = 1)
	 */
	private decodeBitShift(address: DWord, opcode: Byte, size: number): Instruction {
		const modRM = this.mmu.readByte(address);
		const reg = (modRM & InstructionDecoder.REG_MASK) >> 3;

		// reg field determines operation: 4=SHL, 5=SHR
		const operation = reg === 4 ? "SHL" : "SHR";

		const [operand1, , instrSize] = this.decodeModRM(address, size);

		return {
			opcode: opcode,
			operands: [
				operand1,
				{
					type: OperandType.IMMEDIATE,
					value: 1,
					size: 1,
				},
			],
			size: instrSize + 1,
			mnemonic: operation,
		};
	}

	/**
	 * Decode bit shift with immediate count
	 */
	private decodeBitShiftImm(address: DWord, opcode: Byte, size: number): Instruction {
		const modRM = this.mmu.readByte(address);
		const reg = (modRM & InstructionDecoder.REG_MASK) >> 3;

		const operation = reg === 4 ? "SHL" : "SHR";

		const [operand1, , instrSize] = this.decodeModRM(address, size);
		const immediate = this.mmu.readByte(address + instrSize);

		return {
			opcode: opcode,
			operands: [
				operand1,
				{
					type: OperandType.IMMEDIATE,
					value: immediate,
					size: 1,
				},
			],
			size: instrSize + 2,
			mnemonic: operation,
		};
	}

	/**
	 * Decode INC/DEC instructions
	 */
	private decodeINCDEC(address: DWord, opcode: Byte, mnemonic: string): Instruction {
		const regIndex = opcode & 0x07;
		const register = InstructionDecoder.REGISTERS_32[regIndex];

		return {
			opcode: opcode,
			operands: [
				{
					type: OperandType.REGISTER,
					value: regIndex,
					size: 4,
					register: register,
				},
			],
			size: 1,
			mnemonic: mnemonic,
		};
	}

	/**
	 * Decode JMP instruction
	 */
	private decodeJMP(address: DWord, opcode: Byte): Instruction {
		const offset = this.mmu.readDWord(address);
		return {
			opcode: opcode,
			operands: [
				{
					type: OperandType.IMMEDIATE,
					value: offset,
					size: 4,
				},
			],
			size: 5,
			mnemonic: "JMP",
		};
	}

	/**
	 * Decode conditional jump instructions
	 */
	private decodeConditionalJump(address: DWord, opcode: Byte, mnemonic: string): Instruction {
		const offset = this.mmu.readByte(address);
		return {
			opcode: opcode,
			operands: [
				{
					type: OperandType.IMMEDIATE,
					value: offset,
					size: 1,
				},
			],
			size: 2,
			mnemonic: mnemonic,
		};
	}

	/**
	 * Decode PUSH/POP instructions
	 */
	private decodePUSHPOP(address: DWord, opcode: Byte, mnemonic: string): Instruction {
		const regIndex = opcode & 0x07;
		const register = InstructionDecoder.REGISTERS_32[regIndex];

		return {
			opcode: opcode,
			operands: [
				{
					type: OperandType.REGISTER,
					value: regIndex,
					size: 4,
					register: register,
				},
			],
			size: 1,
			mnemonic: mnemonic,
		};
	}

	/**
	 * Decode CALL instruction
	 */
	private decodeCALL(address: DWord, opcode: Byte): Instruction {
		const offset = this.mmu.readDWord(address);
		return {
			opcode: opcode,
			operands: [
				{
					type: OperandType.IMMEDIATE,
					value: offset,
					size: 4,
				},
			],
			size: 5,
			mnemonic: "CALL",
		};
	}

	/**
	 * Decode RET instruction
	 */
	private decodeRET(address: DWord, opcode: Byte): Instruction {
		return {
			opcode: opcode,
			operands: [],
			size: 1,
			mnemonic: "RET",
		};
	}

	/**
	 * Decode INT instruction
	 */
	private decodeINT(address: DWord, opcode: Byte): Instruction {
		const vector = this.mmu.readByte(address);
		return {
			opcode: opcode,
			operands: [
				{
					type: OperandType.IMMEDIATE,
					value: vector,
					size: 1,
				},
			],
			size: 2,
			mnemonic: "INT",
		};
	}

	/**
	 * Decode ModR/M byte
	 */
	private decodeModRM(address: DWord, operandSize: number): [Operand, Operand, number] {
		const modRM = this.mmu.readByte(address);
		const mod = (modRM & InstructionDecoder.MOD_MASK) >> 6;
		const reg = (modRM & InstructionDecoder.REG_MASK) >> 3;
		const rm = modRM & InstructionDecoder.RM_MASK;

		let size = 1; // ModR/M byte

		// decode register operand (always uses the reg field)
		const registerNames = operandSize === 1 ? InstructionDecoder.REGISTERS_8 : InstructionDecoder.REGISTERS_32;
		const regOperand: Operand = {
			type: OperandType.REGISTER,
			value: reg,
			size: operandSize,
			register: registerNames[reg],
		};

		// decode R/M operand
		let rmOperand: Operand;
		let disp8: number;
		let disp32: number;
		let rmRegisterNames: string[];

		switch (mod) {
			case 0: // indirect addressing
				if (rm === 5) {
					// direct addressing
					const displacement = this.mmu.readDWord(address + 1);
					size += 4;
					rmOperand = {
						type: OperandType.MEMORY,
						value: displacement,
						size: operandSize,
					};
				} else {
					rmOperand = {
						type: OperandType.REGISTER_INDIRECT,
						value: rm,
						size: operandSize,
						register: InstructionDecoder.REGISTERS_32[rm], // always use 32-bit register names for addressing
					};
				}
				break;

			case 1:
				// indirect with 8-bit displacement
				disp8 = this.mmu.readByte(address + 1);
				size += 1;
				rmOperand = {
					type: OperandType.REGISTER_INDIRECT_DISPLACEMENT,
					value: rm,
					size: operandSize,
					register: InstructionDecoder.REGISTERS_32[rm], // always use 32-bit register names for addressing
					displacement: disp8,
				};
				break;

			case 2:
				// indirect with 32-bit displacement
				disp32 = this.mmu.readDWord(address + 1);
				size += 4;
				rmOperand = {
					type: OperandType.REGISTER_INDIRECT_DISPLACEMENT,
					value: rm,
					size: operandSize,
					register: InstructionDecoder.REGISTERS_32[rm], // always use 32-bit register names for addressing
					displacement: disp32,
				};
				break;

			case 3: // register direct
				rmRegisterNames = operandSize === 1 ? InstructionDecoder.REGISTERS_8 : InstructionDecoder.REGISTERS_32;
				rmOperand = {
					type: OperandType.REGISTER,
					value: rm,
					size: operandSize,
					register: rmRegisterNames[rm], // use correct register array based on operand size
				};
				break;

			default:
				throw "Invalid ModR/M mod field";
		}

		return [rmOperand, regOperand, size];
	}
}
