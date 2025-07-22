/**
 * CPU Type Definitions
 * Modeling an Intel x86-like architecture
 */

// 8-bit, 16-bit, and 32-bit register types
export type Byte = number; // 8-bit
export type Word = number; // 16-bit
export type DWord = number; // 32-bit

// CPU Flags
export interface CPUFlags {
	CF: boolean; // Carry Flag
	PF: boolean; // Parity Flag
	AF: boolean; // Auxiliary Carry Flag
	ZF: boolean; // Zero Flag
	SF: boolean; // Sign Flag
	TF: boolean; // Trap Flag
	IF: boolean; // Interrupt Enable Flag
	DF: boolean; // Direction Flag
	OF: boolean; // Overflow Flag
}

// General Purpose Registers (32-bit)
export interface GeneralRegisters {
	EAX: DWord; // Accumulator
	EBX: DWord; // Base
	ECX: DWord; // Counter
	EDX: DWord; // Data
	ESI: DWord; // Source Index
	EDI: DWord; // Destination Index
	EBP: DWord; // Base Pointer
	ESP: DWord; // Stack Pointer
}

// Segment Registers
export interface SegmentRegisters {
	CS: Word; // Code Segment
	DS: Word; // Data Segment
	ES: Word; // Extra Segment
	FS: Word; // General Purpose Segment
	GS: Word; // General Purpose Segment
	SS: Word; // Stack Segment
}

// Control Registers
export interface ControlRegisters {
	CR0: DWord; // System Control
	CR2: DWord; // Page Fault Linear Address
	CR3: DWord; // Page Directory Base
	CR4: DWord; // Extended Features
}

// Instruction Pointer
export interface InstructionPointer {
	EIP: DWord; // Extended Instruction Pointer
}

// Instruction Format
export interface Instruction {
	opcode: Byte;
	operands: Operand[];
	size: number; // Instruction size in bytes
	mnemonic: string; // Human-readable instruction name
}

// Operand Types
export enum OperandType {
	REGISTER,
	IMMEDIATE,
	MEMORY,
	REGISTER_INDIRECT,
	REGISTER_INDIRECT_DISPLACEMENT,
}

// Operand
export interface Operand {
	type: OperandType;
	value: number;
	size: number; // 1 = byte, 2 = word, 4 = dword
	register?: string;
	displacement?: number;
}

// Memory Page (4KB)
export const PAGE_SIZE = 4096;

// CPU Statistics
export interface CPUStatistics {
	cycleCount: number;
	instructionCount: number;
	cacheHits: number;
	cacheMisses: number;
	pageFaults: number;
	interrupts: number;
	executionTime: number; // in milliseconds
	clockSpeed: number; // in MHz
	utilization: number; // percentage
}

// CPU State
export interface CPUState {
	generalRegisters: GeneralRegisters;
	segmentRegisters: SegmentRegisters;
	controlRegisters: ControlRegisters;
	instructionPointer: InstructionPointer;
	flags: CPUFlags;
	halted: boolean;
	interruptEnabled: boolean;
}

// Interrupt Vector Table Entry
// export interface InterruptHandler {
// 	vector: number;
// 	handler: (cpu: unknown) => void;
// }
// soon

// Memory Access Types
export enum MemoryAccessType {
	READ,
	WRITE,
	EXECUTE,
}
