import {
	CPUState,
	GeneralRegisters,
	SegmentRegisters,
	ControlRegisters,
	Instruction,
	InstructionPointer,
	CPUFlags,
	OperandType,
	CPUStatistics,
	Operand,
} from "./types";
import { MMU } from "./MMU";
import { InstructionDecoder } from "./InstructionDecoder";

/**
 * Central Processing Unit (CPU)
 * Simulates an x86-like CPU with basic instruction execution
 */
export class CPU {
	private state: CPUState;
	private mmu: MMU;
	private decoder: InstructionDecoder;
	private stats: CPUStatistics;

	constructor(memorySize: number) {
		this.mmu = new MMU(memorySize);
		this.decoder = new InstructionDecoder(this.mmu);

		this.state = {
			generalRegisters: {
				EAX: 0,
				EBX: 0,
				ECX: 0,
				EDX: 0,
				ESI: 0,
				EDI: 0,
				EBP: 0,
				ESP: 0xffff,
			},
			segmentRegisters: {
				CS: 0,
				DS: 0,
				ES: 0,
				FS: 0,
				GS: 0,
				SS: 0,
			},
			controlRegisters: {
				CR0: 0,
				CR2: 0,
				CR3: 0,
				CR4: 0,
			},
			instructionPointer: {
				EIP: 0,
			},
			flags: {
				CF: false,
				PF: false,
				AF: false,
				ZF: false,
				SF: false,
				TF: false,
				IF: false,
				DF: false,
				OF: false,
			},
			halted: false,
			interruptEnabled: true,
		};

		this.stats = {
			cycleCount: 0,
			instructionCount: 0,
			cacheHits: 0,
			cacheMisses: 0,
			pageFaults: 0,
			interrupts: 0,
			executionTime: 0,
			clockSpeed: 3.4, // GHz equivalent in MHz
			utilization: 0,
		};
	}

	/**
	 * Reset CPU state
	 */
	reset(): void {
		this.state.halted = false;
		this.state.instructionPointer.EIP = 0;
		this.stats.cycleCount = 0;
		this.stats.instructionCount = 0;

		// reset registers
		this.state.generalRegisters = {
			EAX: 0,
			EBX: 0,
			ECX: 0,
			EDX: 0,
			ESI: 0,
			EDI: 0,
			EBP: 0,
			ESP: 0xffff,
		};

		// reset flags
		this.state.flags = {
			CF: false,
			PF: false,
			AF: false,
			ZF: false,
			SF: false,
			TF: false,
			IF: false,
			DF: false,
			OF: false,
		};

		// clear cache and reset memory statistics
		this.mmu.clearCaches();
		this.mmu.resetStatistics();

		// unprotect all pages on reset
		this.mmu.unprotectAllPages();
	}

	/**
	 * Load program into memory
	 */
	loadProgram(program: number[], address: number = 0): void {
		// clear any existing protected pages first
		this.mmu.unprotectAllPages();

		// load program using MMU's protected loading
		this.mmu.loadProgram(program, address);

		// set instruction pointer
		this.state.instructionPointer.EIP = address;
	}

	/**
	 * Execute a single instruction
	 */
	step(): void {
		if (this.state.halted) return;

		const address = this.state.instructionPointer.EIP;

		const instruction = this.decoder.decodeInstruction(address);

		const currentEIP = this.state.instructionPointer.EIP;

		this.executeInstruction(instruction);

		this.stats.instructionCount++;
		this.stats.cycleCount += this.calculateCycles(instruction);

		// only advance EIP if it wasn't changed by the instruction (jumps, calls, etc.)
		if (this.state.instructionPointer.EIP === currentEIP) {
			this.state.instructionPointer.EIP += instruction.size;
		}
	}

	/**
	 * Execute an instruction
	 */
	private executeInstruction(instruction: Instruction): void {
		const { mnemonic, operands } = instruction;

		switch (mnemonic) {
			case "RDRAND":
				this.executeRDRAND(operands[0]);
				break;
			case "RDSEED":
				this.executeRDSEED(operands[0]);
				break;
			case "RDTSC":
				this.executeRDTSC();
				break;
			case "CLD":
				this.state.flags.DF = false;
				break;
			case "STD":
				this.state.flags.DF = true;
				break;
			case "CLI":
				this.state.flags.IF = false;
				this.state.interruptEnabled = false;
				break;
			case "STI":
				this.state.flags.IF = true;
				this.state.interruptEnabled = true;
				break;
			case "PUSHF":
				this.executePUSHF();
				break;
			case "POPF":
				this.executePOPF();
				break;
			case "CDQ":
				this.executeCDQ();
				break;
			case "MOV":
				this.executeMOV(operands[0], operands[1]);
				break;
			case "MOVSXD":
				this.executeMOVSXD(operands[0], operands[1]);
				break;
			case "ADD":
				this.executeALUOp(operands[0], operands[1], (a, b) => a + b, true, "ADD");
				break;
			case "SUB":
				this.executeALUOp(operands[0], operands[1], (a, b) => a - b, true, "SUB");
				break;
			case "AND":
				this.executeALUOp(operands[0], operands[1], (a, b) => a & b, true, "AND");
				break;
			case "OR":
				this.executeALUOp(operands[0], operands[1], (a, b) => a | b, true, "OR");
				break;
			case "XOR":
				this.executeALUOp(operands[0], operands[1], (a, b) => a ^ b, true, "XOR");
				break;
			case "INC":
				this.executeINC(operands[0]);
				break;
			case "DEC":
				this.executeDEC(operands[0]);
				break;
			case "SHL":
				this.executeSHL(operands[0], operands[1]);
				break;
			case "SHR":
				this.executeSHR(operands[0], operands[1]);
				break;
			case "TEST":
				this.executeTEST(operands[0], operands[1]);
				break;
			case "XCHG":
				this.executeXCHG(operands[0], operands[1]);
				break;
			case "CMP":
				this.executeCMP(operands[0], operands[1]);
				break;
			case "JMP":
				this.executeJMP(operands[0]);
				break;
			case "JZ":
				this.executeJZ(operands[0]);
				break;
			case "JNZ":
				this.executeJNZ(operands[0]);
				break;
			case "JA":
				this.executeJA(operands[0]);
				break;
			case "JC":
				this.executeJC(operands[0]);
				break;
			case "JP":
				this.executeJP(operands[0]);
				break;
			case "JNS":
				this.executeJNS(operands[0]);
				break;
			case "JL":
				this.executeJL(operands[0]);
				break;
			case "JO":
				this.executeJO(operands[0]);
				break;
			case "JNO":
				this.executeJNO(operands[0]);
				break;
			case "JNC":
				this.executeJNC(operands[0]);
				break;
			case "JBE":
				this.executeJBE(operands[0]);
				break;
			case "JS":
				this.executeJS(operands[0]);
				break;
			case "JNP":
				this.executeJNP(operands[0]);
				break;
			case "JGE":
				this.executeJGE(operands[0]);
				break;
			case "JLE":
				this.executeJLE(operands[0]);
				break;
			case "JG":
				this.executeJG(operands[0]);
				break;
			case "PUSH":
				this.executePUSH(operands[0]);
				break;
			case "POP":
				this.executePOP(operands[0]);
				break;
			case "CALL":
				this.executeCALL(operands[0]);
				break;
			case "RET":
				this.executeRET();
				break;
			case "NOP":
				// do nothing
				break;
			case "HLT":
				this.state.halted = true;
				break;
			case "INT":
				this.executeINT(operands[0]);
				break;
			case "NOT":
				this.executeNOT(operands[0]);
				break;
			case "NEG":
				this.executeNEG(operands[0]);
				break;
			case "MUL":
				this.executeMUL(operands[0]);
				break;
			case "IMUL":
				this.executeIMUL(operands[0]);
				break;
			case "IMUL2":
				this.executeIMUL2(operands[0], operands[1]);
				break;
			case "DIV":
				this.executeDIV(operands[0]);
				break;
			case "IDIV":
				this.executeIDIV(operands[0]);
				break;
			default:
				throw `Unknown instruction: ${mnemonic}`;
		}
	}

	/**
	 * Get operand value
	 */
	private getOperandValue(operand: Operand): number {
		let address: number;
		let baseAddress: number;
		let finalAddress: number;

		if (!operand) {
			throw "Operand is undefined";
		}

		switch (operand.type) {
			case OperandType.REGISTER:
				if (operand.register === undefined) {
					throw "Register name is undefined";
				}
				return this.getRegisterValue(operand.register);
			case OperandType.IMMEDIATE:
				return operand.value ?? 0;
			case OperandType.MEMORY:
				return operand.size === 1
					? this.mmu.readByte(operand.value)
					: operand.size === 2
						? this.mmu.readWord(operand.value)
						: this.mmu.readDWord(operand.value);
			case OperandType.REGISTER_INDIRECT:
				if (operand.register === undefined) {
					throw "Register name is undefined for indirect addressing";
				}
				address = this.getRegisterValue(operand.register);
				return operand.size === 1
					? this.mmu.readByte(address)
					: operand.size === 2
						? this.mmu.readWord(address)
						: this.mmu.readDWord(address);
			case OperandType.REGISTER_INDIRECT_DISPLACEMENT:
				if (operand.register === undefined) {
					throw "Register name is undefined for indirect addressing with displacement";
				}
				baseAddress = this.getRegisterValue(operand.register);
				finalAddress = baseAddress + (operand.displacement ?? 0);
				return operand.size === 1
					? this.mmu.readByte(finalAddress)
					: operand.size === 2
						? this.mmu.readWord(finalAddress)
						: this.mmu.readDWord(finalAddress);
			default:
				throw `Unsupported operand type: ${operand.type}`;
		}
	}

	/**
	 * Set operand value
	 */
	private setOperandValue(operand: Operand, value: number): void {
		let address: number;
		let baseAddress: number;
		let finalAddress: number;

		switch (operand.type) {
			case OperandType.REGISTER:
				if (operand.register === undefined) {
					throw "Register name is undefined";
				}
				this.setRegisterValue(operand.register, value);
				break;
			case OperandType.MEMORY:
				if (operand.size === 1) {
					this.mmu.writeByte(operand.value, value & 0xff);
				} else if (operand.size === 2) {
					this.mmu.writeWord(operand.value, value & 0xffff);
				} else {
					this.mmu.writeDWord(operand.value, value >>> 0);
				}
				break;
			case OperandType.REGISTER_INDIRECT:
				if (operand.register === undefined) {
					throw "Register name is undefined for indirect addressing";
				}
				address = this.getRegisterValue(operand.register);
				if (operand.size === 1) {
					this.mmu.writeByte(address, value & 0xff);
				} else if (operand.size === 2) {
					this.mmu.writeWord(address, value & 0xffff);
				} else {
					this.mmu.writeDWord(address, value >>> 0);
				}
				break;
			case OperandType.REGISTER_INDIRECT_DISPLACEMENT:
				if (operand.register === undefined) {
					throw "Register name is undefined for indirect addressing with displacement";
				}
				baseAddress = this.getRegisterValue(operand.register);
				finalAddress = baseAddress + (operand.displacement ?? 0);
				if (operand.size === 1) {
					this.mmu.writeByte(finalAddress, value & 0xff);
				} else if (operand.size === 2) {
					this.mmu.writeWord(finalAddress, value & 0xffff);
				} else {
					this.mmu.writeDWord(finalAddress, value >>> 0);
				}
				break;
			default:
				throw `Cannot set value for operand type: ${operand.type}`;
		}
	}

	/**
	 * Execute RDRAND instruction (Random Number Generator)
	 */
	private executeRDRAND(dest: Operand): void {
		// random 32-bit number
		const randomValue = math.floor(math.random() * 0x100000000);
		this.setOperandValue(dest, randomValue);

		// set carry flag to indicate success (always successful in this simulation)
		this.state.flags.CF = true;

		this.state.flags.OF = false;
		this.state.flags.SF = false;
		this.state.flags.ZF = false;
		this.state.flags.AF = false;
		this.state.flags.PF = false;
	}

	/**
	 * Execute RDSEED instruction (Random Seed Generator)
	 */
	private executeRDSEED(dest: Operand): void {
		// random seed (more "entropy" than RDRAND)
		const randomSeed = math.floor(math.random() * 0x100000000);
		this.setOperandValue(dest, randomSeed);

		// set carry flag to indicate success
		this.state.flags.CF = true;

		this.state.flags.OF = false;
		this.state.flags.SF = false;
		this.state.flags.ZF = false;
		this.state.flags.AF = false;
		this.state.flags.PF = false;
	}

	/**
	 * Execute RDTSC instruction (Read Time Stamp Counter)
	 */
	private executeRDTSC(): void {
		// simulate time stamp counter (64-bit value)
		const timestamp = os.clock() * 1000000; // converts to microseconds
		const low32 = math.floor(timestamp) & 0xffffffff;
		const high32 = math.floor(timestamp / 0x100000000) & 0xffffffff;

		// store in EDX:EAX
		this.state.generalRegisters.EAX = low32;
		this.state.generalRegisters.EDX = high32;
	}

	/**
	 * Execute PUSHF instruction
	 */
	private executePUSHF(): void {
		const flags = this.packFlags();
		this.state.generalRegisters.ESP -= 4;
		this.mmu.writeDWord(this.state.generalRegisters.ESP, flags);
	}

	/**
	 * Execute POPF instruction
	 */
	private executePOPF(): void {
		const flags = this.mmu.readDWord(this.state.generalRegisters.ESP);
		this.state.generalRegisters.ESP += 4;
		this.unpackFlags(flags);
	}

	/**
	 * Execute CDQ instruction
	 */
	private executeCDQ(): void {
		// sign extend EAX to EDX:EAX

		if ((this.state.generalRegisters.EAX & 0x80000000) !== 0) {
			this.state.generalRegisters.EDX = 0xffffffff;
		} else {
			this.state.generalRegisters.EDX = 0;
		}
	}

	/**
	 * Execute MOV instruction
	 */
	private executeMOV(dest: Operand, src: Operand): void {
		const value = this.getOperandValue(src);
		this.setOperandValue(dest, value);
	}

	/**
	 * Execute MOVSXD instruction (Move with sign extension)
	 */
	private executeMOVSXD(dest: Operand, src: Operand): void {
		const value = this.getOperandValue(src);

		// sign extend from 32-bit to 32-bit (essentially just a move in this case)
		// in 64-bit mode this would extend 32->64, but we're in 32-bit mode
		this.setOperandValue(dest, value);
	}

	/**
	 * Execute ALU operations (ADD, SUB, AND, OR, XOR)
	 */
	private executeALUOp(
		dest: Operand,
		src: Operand,
		operation: (a: number, b: number) => number,
		updateFlags: boolean = true,
		opName?: string,
	): void {
		const destValue = this.getOperandValue(dest);
		const srcValue = this.getOperandValue(src);
		const result = operation(destValue, srcValue);

		this.setOperandValue(dest, result);

		if (updateFlags && opName) {
			this.updateFlags(result, destValue, srcValue, opName);
		} else if (updateFlags) {
			this.updateFlags(result);
		}
	}

	/**
	 * Execute INC instruction
	 */
	private executeINC(operand: Operand): void {
		const value = this.getOperandValue(operand);
		const result = value + 1;
		this.setOperandValue(operand, result);
		this.updateFlags(result, value, 1, "INC");
	}

	/**
	 * Execute DEC instruction
	 */
	private executeDEC(operand: Operand): void {
		const value = this.getOperandValue(operand);
		const result = value - 1;
		this.setOperandValue(operand, result);
		this.updateFlags(result, value, 1, "DEC");
	}

	/**
	 * Execute SHL instruction
	 */
	private executeSHL(dest: Operand, count: Operand): void {
		const value = this.getOperandValue(dest);
		const shiftCount = this.getOperandValue(count);
		const result = value << shiftCount;
		this.setOperandValue(dest, result);
		this.updateFlags(result, value, shiftCount, "SHL");
	}

	/**
	 * Execute SHR instruction
	 */
	private executeSHR(dest: Operand, count: Operand): void {
		const value = this.getOperandValue(dest);
		const shiftCount = this.getOperandValue(count);
		const result = value >>> shiftCount;
		this.setOperandValue(dest, result);
		this.updateFlags(result, value, shiftCount, "SHR");
	}

	/**
	 * Execute TEST instruction
	 */
	private executeTEST(op1: Operand, op2: Operand): void {
		const value1 = this.getOperandValue(op1);
		const value2 = this.getOperandValue(op2);
		const result = value1 & value2;
		this.updateFlags(result);

		this.state.flags.CF = false;
		this.state.flags.OF = false;
	}

	/**
	 * Execute XCHG instruction
	 */
	private executeXCHG(op1: Operand, op2: Operand): void {
		const value1 = this.getOperandValue(op1);
		const value2 = this.getOperandValue(op2);
		this.setOperandValue(op1, value2);
		this.setOperandValue(op2, value1);
	}

	/**
	 * Execute CMP instruction
	 */
	private executeCMP(op1: Operand, op2: Operand): void {
		const value1 = this.getOperandValue(op1);
		const value2 = this.getOperandValue(op2);
		const result = value1 - value2;
		this.updateFlags(result, value1, value2, "CMP");
	}

	/**
	 * Execute JMP instruction
	 */
	private executeJMP(target: Operand): void {
		if (target.size === 1) {
			// relative jump with 8-bit offset (signed)
			const offset = target.value > 127 ? target.value - 256 : target.value;
			this.state.instructionPointer.EIP += offset;
		} else {
			// absolute jump for 32-bit operands
			this.state.instructionPointer.EIP = target.value;
		}
	}

	/**
	 * Execute JZ instruction
	 */
	private executeJZ(target: Operand): void {
		if (this.state.flags.ZF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JNZ instruction
	 */
	private executeJNZ(target: Operand): void {
		if (!this.state.flags.ZF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JO instruction (Jump if Overflow)
	 */
	private executeJO(target: Operand): void {
		if (this.state.flags.OF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JNO instruction (Jump if Not Overflow)
	 */
	private executeJNO(target: Operand): void {
		if (!this.state.flags.OF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JNC instruction (Jump if Not Carry)
	 */
	private executeJNC(target: Operand): void {
		if (!this.state.flags.CF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JBE instruction (Jump if Below or Equal)
	 */
	private executeJBE(target: Operand): void {
		if (this.state.flags.CF || this.state.flags.ZF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JS instruction (Jump if Sign)
	 */
	private executeJS(target: Operand): void {
		if (this.state.flags.SF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JNP instruction (Jump if Not Parity)
	 */
	private executeJNP(target: Operand): void {
		if (!this.state.flags.PF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JGE instruction (Jump if Greater or Equal)
	 */
	private executeJGE(target: Operand): void {
		if (this.state.flags.SF === this.state.flags.OF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JLE instruction (Jump if Less or Equal)
	 */
	private executeJLE(target: Operand): void {
		if (this.state.flags.ZF || this.state.flags.SF !== this.state.flags.OF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JG instruction (Jump if Greater)
	 */
	private executeJG(target: Operand): void {
		if (!this.state.flags.ZF && this.state.flags.SF === this.state.flags.OF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JA instruction (Jump if Above - unsigned)
	 */
	private executeJA(target: Operand): void {
		if (!this.state.flags.CF && !this.state.flags.ZF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JC instruction (Jump if Carry)
	 */
	private executeJC(target: Operand): void {
		if (this.state.flags.CF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JP instruction (Jump if Parity)
	 */
	private executeJP(target: Operand): void {
		if (this.state.flags.PF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JNS instruction (Jump if Not Sign)
	 */
	private executeJNS(target: Operand): void {
		if (!this.state.flags.SF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute JL instruction (Jump if Less - signed)
	 */
	private executeJL(target: Operand): void {
		if (this.state.flags.SF !== this.state.flags.OF) {
			this.executeJMP(target);
		}
	}

	/**
	 * Execute PUSH instruction
	 */
	private executePUSH(operand: Operand): void {
		const value = this.getOperandValue(operand);
		this.state.generalRegisters.ESP -= 4;
		this.mmu.writeDWord(this.state.generalRegisters.ESP, value);
	}

	/**
	 * Execute POP instruction
	 */
	private executePOP(operand: Operand): void {
		const value = this.mmu.readDWord(this.state.generalRegisters.ESP);
		this.setOperandValue(operand, value);
		this.state.generalRegisters.ESP += 4;
	}

	/**
	 * Execute CALL instruction
	 */
	private executeCALL(target: Operand): void {
		// push return address onto stack
		this.state.generalRegisters.ESP -= 4;
		this.mmu.writeDWord(this.state.generalRegisters.ESP, this.state.instructionPointer.EIP);

		// jump to target
		this.executeJMP(target);
	}

	/**
	 * Execute RET instruction
	 */
	private executeRET(): void {
		const returnAddress = this.mmu.readDWord(this.state.generalRegisters.ESP);
		this.state.generalRegisters.ESP += 4;
		this.state.instructionPointer.EIP = returnAddress;
	}

	/**
	 * Execute INT instruction
	 */
	private executeINT(vector: Operand): void {
		const vectorNumber = this.getOperandValue(vector);
		// just increment interrupt counter here
		this.stats.interrupts++;

		// treat as NOP for now, maybe interrupt vector table l8r
		if (vectorNumber === 0x21) {
			// dos interrupt
		}
	}

	/**
	 * Execute NOT instruction
	 */
	private executeNOT(operand: Operand): void {
		const value = this.getOperandValue(operand);
		const result = ~value; // bitwise NOT
		this.setOperandValue(operand, result);
		// NOT doesn't affect flags
	}

	/**
	 * Execute NEG instruction
	 */
	private executeNEG(operand: Operand): void {
		const value = this.getOperandValue(operand);
		const result = -value; // two's complement negation
		this.setOperandValue(operand, result);
		this.updateFlags(result);
		// set carry flag if operand was not zero
		this.state.flags.CF = value !== 0;
	}

	/**
	 * Execute MUL instruction (unsigned multiply)
	 */
	private executeMUL(operand: Operand): void {
		const multiplier = this.getOperandValue(operand);
		const multiplicand = this.state.generalRegisters.EAX;
		const result = multiplicand * multiplier;

		// for 32-bit: result fits in EAX, high bits indicate overflow
		this.state.generalRegisters.EAX = result & 0xffffffff;
		this.state.generalRegisters.EDX = 0; // clear EDX for 32-bit operation

		// set CF and OF if result overflows 32 bits
		this.state.flags.CF = this.state.flags.OF = result > 0xffffffff;
	}

	/**
	 * Execute IMUL instruction (signed multiply)
	 */
	private executeIMUL(operand: Operand): void {
		const multiplier = this.getOperandValue(operand);
		const multiplicand = this.state.generalRegisters.EAX;

		// convert to signed 32-bit
		const signedMultiplier = multiplier > 0x7fffffff ? multiplier - 0x100000000 : multiplier;
		const signedMultiplicand = multiplicand > 0x7fffffff ? multiplicand - 0x100000000 : multiplicand;

		const result = signedMultiplicand * signedMultiplier;

		// for 32-bit: store result in EAX
		this.state.generalRegisters.EAX = result & 0xffffffff;
		this.state.generalRegisters.EDX = 0; // clear EDX for 32-bit operation

		// set CF and OF if result doesn't fit in signed 32 bits
		this.state.flags.CF = this.state.flags.OF = result < -0x80000000 || result > 0x7fffffff;
	}

	/**
	 * Execute IMUL with two operands (0x0F 0xAF)
	 */
	private executeIMUL2(dest: Operand, src: Operand): void {
		const value1 = this.getOperandValue(dest);
		const value2 = this.getOperandValue(src);

		// convert to signed 32-bit
		const signed1 = value1 > 0x7fffffff ? value1 - 0x100000000 : value1;
		const signed2 = value2 > 0x7fffffff ? value2 - 0x100000000 : value2;

		const result = signed1 * signed2;
		this.setOperandValue(dest, result & 0xffffffff);

		// set CF and OF if result doesn't fit in 32 bits
		this.state.flags.CF = this.state.flags.OF = result < -0x80000000 || result > 0x7fffffff;
		this.updateFlags(result & 0xffffffff);
	}

	/**
	 * Execute DIV instruction (unsigned divide)
	 */
	private executeDIV(operand: Operand): void {
		const divisor = this.getOperandValue(operand);
		if (divisor === 0) {
			throw "Division by zero";
		}

		// For 32-bit: dividend is just EAX
		const dividend = this.state.generalRegisters.EAX;
		const quotient = math.floor(dividend / divisor);
		const remainder = dividend % divisor;

		this.state.generalRegisters.EAX = quotient & 0xffffffff;
		this.state.generalRegisters.EDX = remainder & 0xffffffff;
	}

	/**
	 * Execute IDIV instruction (signed divide)
	 */
	private executeIDIV(operand: Operand): void {
		const divisor = this.getOperandValue(operand);
		if (divisor === 0) {
			throw "Division by zero";
		}

		// for 32-bit: dividend is just EAX (convert to signed)
		let dividend = this.state.generalRegisters.EAX;
		if (dividend > 0x7fffffff) {
			dividend -= 0x100000000; // converts to 32-bit
		}

		const signedDivisor = divisor > 0x7fffffff ? divisor - 0x100000000 : divisor;

		const quotient = math.floor(dividend / signedDivisor);
		const remainder = dividend % signedDivisor;

		if (quotient < -0x80000000 || quotient > 0x7fffffff) {
			throw "Division overflow";
		}

		this.state.generalRegisters.EAX = quotient & 0xffffffff;
		this.state.generalRegisters.EDX = remainder & 0xffffffff;
	}

	/**
	 * Pack CPU flags into a 32-bit value
	 */
	private packFlags(): number {
		let flags = 0;

		if (this.state.flags.CF) flags |= 0x0001; // bit 0
		if (this.state.flags.PF) flags |= 0x0004; // bit 2
		if (this.state.flags.AF) flags |= 0x0010; // bit 4
		if (this.state.flags.ZF) flags |= 0x0040; // bit 6
		if (this.state.flags.SF) flags |= 0x0080; // bit 7
		if (this.state.flags.TF) flags |= 0x0100; // bit 8
		if (this.state.flags.IF) flags |= 0x0200; // bit 9
		if (this.state.flags.DF) flags |= 0x0400; // bit 10
		if (this.state.flags.OF) flags |= 0x0800; // bit 11

		// set reserved bits (bit 1 is always 1, bit 14-15 are always 0 in real mode)
		flags |= 0x0002; // bit 1 is always set

		return flags;
	}

	/**
	 * Unpack 32-bit value into CPU flags
	 */
	private unpackFlags(flags: number): void {
		this.state.flags.CF = (flags & 0x0001) !== 0;
		this.state.flags.PF = (flags & 0x0004) !== 0;
		this.state.flags.AF = (flags & 0x0010) !== 0;
		this.state.flags.ZF = (flags & 0x0040) !== 0;
		this.state.flags.SF = (flags & 0x0080) !== 0;
		this.state.flags.TF = (flags & 0x0100) !== 0;
		this.state.flags.IF = (flags & 0x0200) !== 0;
		this.state.flags.DF = (flags & 0x0400) !== 0;
		this.state.flags.OF = (flags & 0x0800) !== 0;
	}

	/**
	 * Update CPU flags based on result with operation context
	 */
	private updateFlags(result: number, operand1?: number, operand2?: number, operation?: string): void {
		// ensure result is treated as 32-bit unsigned
		const result32 = result >>> 0;

		// ZF
		this.state.flags.ZF = result32 === 0;

		// SF (check if MSB is set for 32-bit value)
		this.state.flags.SF = (result32 & 0x80000000) !== 0;

		// PF (even number of 1 bits in lower 8 bits)
		let parity = 0;
		let temp = result32 & 0xff;
		while (temp !== 0) {
			parity ^= temp & 1;
			temp >>>= 1;
		}
		this.state.flags.PF = parity === 0;

		// CF - depends on operation type
		if (operand1 !== undefined && operand2 !== undefined && operation) {
			switch (operation) {
				case "ADD":
				case "INC":
					// CF set if unsigned overflow
					this.state.flags.CF = result > 0xffffffff;
					break;
				case "SUB":
				case "DEC":
				case "CMP":
					// CF set if borrow occurred (operand1 < operand2 for unsigned)
					this.state.flags.CF = operand1 >>> 0 < operand2 >>> 0;
					break;
				case "SHL":
					// CF = last bit shifted out
					if (operand2 > 0 && operand2 <= 32) {
						this.state.flags.CF = ((operand1 >>> 0) & (1 << (32 - operand2))) !== 0;
					}
					break;
				case "SHR":
					// CF = last bit shifted out
					if (operand2 > 0 && operand2 <= 32) {
						this.state.flags.CF = ((operand1 >>> 0) & (1 << (operand2 - 1))) !== 0;
					}
					break;
				default:
					// for logical operations (AND, OR, XOR), CF is cleared
					this.state.flags.CF = false;
			}

			// OF - signed overflow detection
			const op1_32 = operand1 | 0; // convert to signed 32-bit
			const op2_32 = operand2 | 0;
			const result_32 = result | 0;

			switch (operation) {
				case "ADD":
				case "INC":
					// OF set if signs of operands are same but result sign differs
					this.state.flags.OF =
						(op1_32 >= 0 && op2_32 >= 0 && result_32 < 0) || (op1_32 < 0 && op2_32 < 0 && result_32 >= 0);
					break;
				case "SUB":
				case "DEC":
				case "CMP":
					// OF set if signs of operands differ and result sign matches subtrahend
					this.state.flags.OF =
						(op1_32 >= 0 && op2_32 < 0 && result_32 < 0) || (op1_32 < 0 && op2_32 >= 0 && result_32 >= 0);
					break;
				case "SHL":
					// OF set if sign bit changes during shift
					if (operand2 === 1) {
						const msb = (operand1 >>> 0) & 0x80000000;
						const secondMsb = (operand1 >>> 0) & 0x40000000;
						this.state.flags.OF = (msb !== 0) !== (secondMsb !== 0);
					}
					break;
				default:
					// for logical operations, OF is cleared
					this.state.flags.OF = false;
			}

			// AF - carry from bit 3 to bit 4
			switch (operation) {
				case "ADD":
				case "INC":
					this.state.flags.AF = (operand1 & 0xf) + (operand2 & 0xf) > 0xf;
					break;
				case "SUB":
				case "DEC":
				case "CMP":
					this.state.flags.AF = (operand1 & 0xf) < (operand2 & 0xf);
					break;
				default:
					// AF is undefined for logical operations, but we'll clear it
					this.state.flags.AF = false;
			}
		} else {
			// simple flag calculation for operations without context
			this.state.flags.OF = result > 0x7fffffff || result < -0x80000000;
			this.state.flags.CF = result > 0xffffffff || result < 0;
			this.state.flags.AF = false; // default for unknown operations
		}
	}

	/**
	 * Calculate cycles required by instruction
	 */
	private calculateCycles(instruction: Instruction): number {
		// simple cycle calculation based on instruction complexity
		switch (instruction.mnemonic) {
			case "NOP":
				return 1;
			case "MOV":
				return 1;
			case "ADD":
			case "SUB":
			case "AND":
			case "OR":
			case "XOR":
				return 1;
			case "INC":
			case "DEC":
				return 1;
			case "SHL":
			case "SHR":
				return 2;
			case "CMP":
			case "TEST":
				return 1;
			case "JMP":
			case "JZ":
			case "JNZ":
			case "JA":
			case "JC":
			case "JP":
			case "JNS":
			case "JL":
				return 1;
			case "PUSH":
			case "POP":
				return 2;
			case "CALL":
				return 3;
			case "RET":
				return 3;
			case "INT":
				return 10;
			case "HLT":
				return 1;
			default:
				return 1;
		}
	}

	/**
	 * Get register value
	 */
	private getRegisterValue(registerName: string): number {
		switch (registerName) {
			// 8-bit registers
			case "AL":
				return this.state.generalRegisters.EAX & 0xff;
			case "AH":
				return (this.state.generalRegisters.EAX >> 8) & 0xff;
			case "BL":
				return this.state.generalRegisters.EBX & 0xff;
			case "BH":
				return (this.state.generalRegisters.EBX >> 8) & 0xff;
			case "CL":
				return this.state.generalRegisters.ECX & 0xff;
			case "CH":
				return (this.state.generalRegisters.ECX >> 8) & 0xff;
			case "DL":
				return this.state.generalRegisters.EDX & 0xff;
			case "DH":
				return (this.state.generalRegisters.EDX >> 8) & 0xff;
			// 32-bit registers
			case "EAX":
				return this.state.generalRegisters.EAX;
			case "EBX":
				return this.state.generalRegisters.EBX;
			case "ECX":
				return this.state.generalRegisters.ECX;
			case "EDX":
				return this.state.generalRegisters.EDX;
			case "ESI":
				return this.state.generalRegisters.ESI;
			case "EDI":
				return this.state.generalRegisters.EDI;
			case "EBP":
				return this.state.generalRegisters.EBP;
			case "ESP":
				return this.state.generalRegisters.ESP;
			default:
				throw `Unknown register: ${registerName}`;
		}
	}

	/**
	 * Set register value
	 */
	private setRegisterValue(registerName: string, value: number): void {
		const maskedValue = value >>> 0; // converts to unsigned 32-bit

		switch (registerName) {
			// 8-bit registers
			case "AL":
				this.state.generalRegisters.EAX = (this.state.generalRegisters.EAX & 0xffffff00) | (maskedValue & 0xff);
				break;
			case "AH":
				this.state.generalRegisters.EAX =
					(this.state.generalRegisters.EAX & 0xffff00ff) | ((maskedValue & 0xff) << 8);
				break;
			case "BL":
				this.state.generalRegisters.EBX = (this.state.generalRegisters.EBX & 0xffffff00) | (maskedValue & 0xff);
				break;
			case "BH":
				this.state.generalRegisters.EBX =
					(this.state.generalRegisters.EBX & 0xffff00ff) | ((maskedValue & 0xff) << 8);
				break;
			case "CL":
				this.state.generalRegisters.ECX = (this.state.generalRegisters.ECX & 0xffffff00) | (maskedValue & 0xff);
				break;
			case "CH":
				this.state.generalRegisters.ECX =
					(this.state.generalRegisters.ECX & 0xffff00ff) | ((maskedValue & 0xff) << 8);
				break;
			case "DL":
				this.state.generalRegisters.EDX = (this.state.generalRegisters.EDX & 0xffffff00) | (maskedValue & 0xff);
				break;
			case "DH":
				this.state.generalRegisters.EDX =
					(this.state.generalRegisters.EDX & 0xffff00ff) | ((maskedValue & 0xff) << 8);
				break;
			// 32-bit registers
			case "EAX":
				this.state.generalRegisters.EAX = maskedValue;
				break;
			case "EBX":
				this.state.generalRegisters.EBX = maskedValue;
				break;
			case "ECX":
				this.state.generalRegisters.ECX = maskedValue;
				break;
			case "EDX":
				this.state.generalRegisters.EDX = maskedValue;
				break;
			case "ESI":
				this.state.generalRegisters.ESI = maskedValue;
				break;
			case "EDI":
				this.state.generalRegisters.EDI = maskedValue;
				break;
			case "EBP":
				this.state.generalRegisters.EBP = maskedValue;
				break;
			case "ESP":
				this.state.generalRegisters.ESP = maskedValue;
				break;
			default:
				throw `Unknown register: ${registerName}`;
		}
	}

	/**
	 * Get current CPU statistics
	 */
	getStatistics(): CPUStatistics {
		const mmuStats = this.mmu.getStatistics();
		return {
			...this.stats,
			pageFaults: mmuStats.pageFaults,
			cacheHits: mmuStats.cacheHits,
			cacheMisses: mmuStats.cacheMisses,
			utilization: this.stats.cycleCount > 0 ? (this.stats.instructionCount / this.stats.cycleCount) * 100 : 0,
		};
	}

	/**
	 * Get current CPU state
	 */
	getState(): CPUState {
		return {
			generalRegisters: { ...this.state.generalRegisters },
			segmentRegisters: { ...this.state.segmentRegisters },
			controlRegisters: { ...this.state.controlRegisters },
			instructionPointer: { ...this.state.instructionPointer },
			flags: { ...this.state.flags },
			halted: this.state.halted,
			interruptEnabled: this.state.interruptEnabled,
		};
	}

	/**
	 * Get Memory Management Unit
	 */
	getMMU(): MMU {
		return this.mmu;
	}

	/**
	 * Get Instruction Decoder
	 */
	getDecoder(): InstructionDecoder {
		return this.decoder;
	}

	/**
	 * Check if CPU is halted
	 */
	isHalted(): boolean {
		return this.state.halted;
	}

	/**
	 * Get instruction at address (for debugging/visualization)
	 */
	getInstructionAt(address: number): Instruction {
		return this.decoder.decodeInstruction(address);
	}

	/**
	 * Get multiple instructions starting from address (for disassembly view)
	 */
	getInstructionsAt(startAddress: number, count: number): Instruction[] {
		const instructions: Instruction[] = [];
		let currentAddress = startAddress;

		for (let i = 0; i < count; i++) {
			try {
				const instruction = this.decoder.decodeInstruction(currentAddress);
				instructions.push(instruction);
				currentAddress += instruction.size;
			} catch (error) {
				// invalid instruction hit so we stop
				break;
			}
		}

		return instructions;
	}

	/**
	 * Set breakpoint at address (for debugging)
	 */
	private breakpoints: Set<number> = new Set();

	setBreakpoint(address: number): void {
		this.breakpoints.add(address);
	}

	removeBreakpoint(address: number): void {
		this.breakpoints.delete(address);
	}

	clearBreakpoints(): void {
		this.breakpoints.clear();
	}

	/**
	 * Check if current instruction pointer is at a breakpoint
	 */
	isAtBreakpoint(): boolean {
		return this.breakpoints.has(this.state.instructionPointer.EIP);
	}

	/**
	 * Run until breakpoint or halt
	 */
	runUntilBreakpoint(): void {
		while (!this.state.halted && !this.isAtBreakpoint()) {
			this.step();
		}
	}
}
