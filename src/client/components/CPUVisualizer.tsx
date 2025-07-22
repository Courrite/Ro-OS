import React, { useState, useEffect } from "@rbxts/react";
import { CPU } from "shared/cpu/CPU";
import { CPUState, CPUStatistics } from "shared/cpu/types";
import { RegisterDisplay } from "./RegisterDisplay";
import { MemoryDisplay } from "./MemoryDisplay";
import { StatisticsDisplay } from "./StatisticsDisplay";
import { InstructionDisplay } from "./InstructionDisplay";
import { FlagsDisplay } from "./FlagsDisplay";

interface CPUVisualizerProps {
	cpu: CPU;
}

export function CPUVisualizer({ cpu }: CPUVisualizerProps) {
	const [cpuState, setCpuState] = useState<CPUState | undefined>();
	const [statistics, setStatistics] = useState<CPUStatistics | undefined>();
	const [isRunning, setIsRunning] = useState(false);
	const [updateTick, setUpdateTick] = useState(0);

	useEffect(() => {
		const connection = game.GetService("RunService").Heartbeat.Connect(() => {
			if (isRunning) {
				cpu.step();
			}

			setCpuState(cpu.getState());
			setStatistics(cpu.getStatistics());
			setUpdateTick((tick) => tick + 1);
		});

		return () => connection.Disconnect();
	}, [cpu, isRunning]);

	const handleStep = () => {
		cpu.step();
	};

	const handleRun = () => {
		setIsRunning(true);
	};

	const handlePause = () => {
		setIsRunning(false);
	};

	const handleReset = () => {
		setIsRunning(false);
		cpu.reset();
	};

	const handleLoadProgram = () => {
		// flag toggle demo
		/** if you see this, the operands (0xFF or FF) for operations go from bottom to top like this:
		 * 0xeb (32-bit JMP op)
		 * 0x12
		 * 0x34
		 * 0x56
		 * 0x78
		 * basically the first operand is the LSB and the last operand is the MSB
		 * the full instruction is JMP 0x 78 56 34 12
		 */
		const program = [
			0xb8, // MOV EAX, 0x80371342
			0x42,
			0x13,
			0x37,
			0x80,

			0xbb, // MOV EBX, 0
			0x00,
			0x00,
			0x00,
			0x00,

			0xb9, // MOV ECX, 0x7FFFFFFF
			0xff,
			0xff,
			0xff,
			0x7f,

			0xba, // MOV EDX, 0x80000001
			0x01,
			0x00,
			0x00,
			0x80,

			0xbe, // MOV ESI, 0
			0x00,
			0x00,
			0x00,
			0x00,

			// loop start (address 0x1019)
			0x46, // INC ESI

			// ADD operations - affects CF, OF, SF, ZF, AF, PF
			0x01, // ADD EAX, EBX
			0xd8,

			0x01, // ADD EBX, ECX
			0xcb,

			// XOR with self - clears CF, OF; sets ZF; affects SF, PF
			0x31, // XOR EBX, EBX
			0xdb,

			// ADD immediate - affects all arithmetic flags
			0x83, // ADD EBX, 0x55
			0xc3,
			0x55,

			0x83, // ADD EBX, 0xAA
			0xc3,
			0xaa,

			// shift operations - affects CF, OF
			0xd1, // SHL EAX, 1
			0xe0,

			0xd1, // SHR ECX, 1
			0xe9,

			// SUB operation - may set CF if borrow occurs
			0x29, // SUB EDX, ESI
			0xf2,

			// CMP operations - sets flags based on comparison
			0x39, // CMP ECX, EAX
			0xc1,

			0x39, // CMP EDX, EBX
			0xda,

			// TEST with alternating patterns - affects SF, ZF, PF; clears CF, OF
			0xb8, // MOV EAX, 0x55555555
			0x55,
			0x55,
			0x55,
			0x55,

			0x85, // TEST EAX, EAX
			0xc0,

			0xb8, // MOV EAX, 0xAAAAAAAA
			0xaa,
			0xaa,
			0xaa,
			0xaa,

			0x85, // TEST EAX, EAX
			0xc0,

			// overflow testing - INC at max positive value
			0xb8, // MOV EAX, 0x7FFFFFFF
			0xff,
			0xff,
			0xff,
			0x7f,

			0x40, // INC EAX (sets OF - overflow to negative)

			// underflow testing - DEC at min negative value
			0xb8, // MOV EAX, 0x80000000
			0x00,
			0x00,
			0x00,
			0x80,

			0x48, // DEC EAX (sets OF - underflow)

			// logical AND - should result in 0, set ZF
			0xb8, // MOV EAX, 0x0F0F0F0F
			0x0f,
			0x0f,
			0x0f,
			0x0f,

			0xbb, // MOV EBX, 0xF0F0F0F0
			0xf0,
			0xf0,
			0xf0,
			0xf0,

			0x21, // AND EAX, EBX
			0xd8,

			// logical OR - clears ZF, affects PF
			0x09, // OR EAX, EBX
			0xd8,

			// chain shifts for carry propagation
			0xb8, // MOV EAX, 1
			0x01,
			0x00,
			0x00,
			0x00,

			0xd1, // SHL EAX, 1
			0xe0,

			0xd1, // SHL EAX, 1
			0xe0,

			0xd1, // SHL EAX, 1
			0xe0,

			// SUB immediate - sets CF, SF if result negative
			0x83, // SUB EAX, 9
			0xe8,
			0x09,

			// Flag manipulation instructions to toggle IF, DF
			0xfa, // CLI

			0xfb, // STI

			0xfc, // CLD

			0xfd, // STD

			// PUSHF/POPF to manipulate TF
			0x9c, // PUSHF

			0x58, // POP EAX

			// Set TF bit (bit 8 = 0x100) using existing instructions
			0xbb, // MOV EBX, 0x100
			0x00,
			0x01,
			0x00,
			0x00,

			0x09, // OR EAX, EBX (set TF bit)
			0xd8,

			0x50, // PUSH EAX (push modified flags)

			0x9d, // POPF (pop flags with TF set)

			// Clear TF bit
			0x9c, // PUSHF

			0x58, // POP EAX

			0xbb, // MOV EBX, 0xFFFFFEFF
			0xff,
			0xfe,
			0xff,
			0xff,

			0x21, // AND EAX, EBX (clear TF bit)
			0xd8,

			0x50, // PUSH EAX

			0x9d, // POPF (pop flags with TF cleared)

			// carry chain operations
			0xb8, // MOV EAX, 0xFFFFFFFF
			0xff,
			0xff,
			0xff,
			0xff,

			0x83, // ADD EAX, 1 (sets CF due to overflow)
			0xc0,
			0x01,

			// borrow operation
			0xb8, // MOV EAX, 0
			0x00,
			0x00,
			0x00,
			0x00,

			0x83, // SUB EAX, 1 (sets CF due to borrow)
			0xe8,
			0x01,

			// SF testing
			0xb8, // MOV EAX, 0x7F
			0x7f,
			0x00,
			0x00,
			0x00,

			0x85, // TEST EAX, EAX (clears SF)
			0xc0,

			0xb8, // MOV EAX, 0x80000000
			0x00,
			0x00,
			0x00,
			0x80,

			0x85, // TEST EAX, EAX (sets SF)
			0xc0,

			// division for quotient testing
			0xb8, // MOV EAX, 100
			0x64,
			0x00,
			0x00,
			0x00,

			0xb9, // MOV ECX, 3
			0x03,
			0x00,
			0x00,
			0x00,

			0x31, // XOR EDX, EDX (clear EDX for division)
			0xd2,

			0xf7, // DIV ECX (EAX = EAX / ECX)
			0xf1,

			0x85, // TEST EAX, EAX (test quotient)
			0xc0,

			// boundary increment testing
			0xb8, // MOV EAX, 0xFFFFFFFE
			0xfe,
			0xff,
			0xff,
			0xff,

			0x40, // INC EAX (becomes -1)
			0x40, // INC EAX (becomes 0, sets ZF)
			0x40, // INC EAX (becomes 1, clears ZF)

			// Parity testing with different bit patterns
			0xb8, // MOV EAX, 0x08040201
			0x01,
			0x02,
			0x04,
			0x08,

			0x85, // TEST EAX, EAX (affects PF)
			0xc0,

			0xb8, // MOV EAX, 0x10204080
			0x80,
			0x40,
			0x20,
			0x10,

			0x85, // TEST EAX, EAX (affects PF differently)
			0xc0,

			// final showcase operation
			0xb8, // MOV EAX, 0x42424242
			0x42,
			0x42,
			0x42,
			0x42,

			0xbb, // MOV EBX, 0x24242424
			0x24,
			0x24,
			0x24,
			0x24,

			0x01, // ADD EAX, EBX
			0xd8,

			// unconditional jump back to loop start
			0xe9, // JMP 0xFFFFFF30 (0x1019)
			0x30,
			0xff,
			0xff,
			0xff,
		];

		cpu.loadProgram(program, 0x1000);
	};

	if (!cpuState || !statistics) {
		return (
			<frame Size={UDim2.fromScale(1, 1)} BackgroundColor3={new Color3(0.1, 0.1, 0.1)}>
				<textlabel
					Text="Loading CPU..."
					Size={UDim2.fromScale(1, 1)}
					TextColor3={new Color3(1, 1, 1)}
					TextScaled={true}
					BackgroundTransparency={1}
				/>
			</frame>
		);
	}

	return (
		<frame Size={UDim2.fromScale(1, 1)} BackgroundColor3={new Color3(0.1, 0.1, 0.1)}>
			<uipadding
				PaddingLeft={new UDim(0, 10)}
				PaddingRight={new UDim(0, 10)}
				PaddingTop={new UDim(0, 10)}
				PaddingBottom={new UDim(0, 10)}
			/>

			{/* Header */}
			<frame
				key="Header"
				Size={new UDim2(1, 0, 0, 50)}
				BackgroundColor3={new Color3(0.15, 0.15, 0.15)}
				BorderSizePixel={0}
			>
				<textlabel
					Text="CPU Visualizer"
					Size={new UDim2(0.5, 0, 1, 0)}
					TextColor3={new Color3(1, 1, 1)}
					TextScaled={true}
					BackgroundTransparency={1}
					Font={Enum.Font.SourceSansBold}
				/>

				{/* Control Buttons */}
				<frame
					key="Controls"
					Size={new UDim2(0.5, 0, 1, 0)}
					Position={new UDim2(0.5, 0, 0, 0)}
					BackgroundTransparency={1}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						HorizontalAlignment={Enum.HorizontalAlignment.Right}
						Padding={new UDim(0, 5)}
					/>

					<textbutton
						Text="Load Program"
						Size={new UDim2(0, 100, 0.8, 0)}
						BackgroundColor3={new Color3(0.2, 0.4, 0.8)}
						TextColor3={new Color3(1, 1, 1)}
						TextScaled={true}
						Event={{
							MouseButton1Click: handleLoadProgram,
						}}
					>
						<uicorner CornerRadius={new UDim(0, 5)} />
					</textbutton>

					<textbutton
						Text="Step"
						Size={new UDim2(0, 60, 0.8, 0)}
						BackgroundColor3={new Color3(0.2, 0.6, 0.2)}
						TextColor3={new Color3(1, 1, 1)}
						TextScaled={true}
						Event={{
							MouseButton1Click: handleStep,
						}}
					>
						<uicorner CornerRadius={new UDim(0, 5)} />
					</textbutton>

					<textbutton
						Text={isRunning ? "Pause" : "Run"}
						Size={new UDim2(0, 60, 0.8, 0)}
						BackgroundColor3={isRunning ? new Color3(0.8, 0.4, 0.2) : new Color3(0.2, 0.6, 0.2)}
						TextColor3={new Color3(1, 1, 1)}
						TextScaled={true}
						Event={{
							MouseButton1Click: isRunning ? handlePause : handleRun,
						}}
					>
						<uicorner CornerRadius={new UDim(0, 5)} />
					</textbutton>

					<textbutton
						Text="Reset"
						Size={new UDim2(0, 60, 0.8, 0)}
						BackgroundColor3={new Color3(0.8, 0.2, 0.2)}
						TextColor3={new Color3(1, 1, 1)}
						TextScaled={true}
						Event={{
							MouseButton1Click: handleReset,
						}}
					>
						<uicorner CornerRadius={new UDim(0, 5)} />
					</textbutton>
				</frame>
			</frame>

			{/* Main Content */}
			<frame
				key="MainContent"
				Size={new UDim2(1, 0, 1, -60)}
				Position={new UDim2(0, 0, 0, 60)}
				BackgroundTransparency={1}
			>
				{/* Left Panel - Registers and Flags */}
				<frame key="LeftPanel" Size={new UDim2(0.3, -5, 1, 0)} BackgroundColor3={new Color3(0.15, 0.15, 0.15)}>
					<uicorner CornerRadius={new UDim(0, 5)} />
					<uipadding
						PaddingLeft={new UDim(0, 10)}
						PaddingRight={new UDim(0, 10)}
						PaddingTop={new UDim(0, 10)}
						PaddingBottom={new UDim(0, 10)}
					/>

					<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 10)} />

					<RegisterDisplay
						generalRegisters={cpuState.generalRegisters}
						instructionPointer={cpuState.instructionPointer}
					/>

					<FlagsDisplay flags={cpuState.flags} />
				</frame>

				{/* Middle Panel - Instruction Display */}
				<frame
					key="MiddlePanel"
					Size={new UDim2(0.4, -10, 1, 0)}
					Position={new UDim2(0.3, 5, 0, 0)}
					BackgroundColor3={new Color3(0.15, 0.15, 0.15)}
				>
					<uicorner CornerRadius={new UDim(0, 5)} />
					<InstructionDisplay
						cpu={cpu}
						currentAddress={cpuState.instructionPointer.EIP}
						isHalted={cpuState.halted}
					/>
				</frame>

				{/* Right Panel - Memory and Statistics */}
				<frame
					key="RightPanel"
					Size={new UDim2(0.3, -5, 1, 0)}
					Position={new UDim2(0.7, 5, 0, 0)}
					BackgroundColor3={new Color3(0.15, 0.15, 0.15)}
				>
					<uicorner CornerRadius={new UDim(0, 5)} />
					<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 10)} />

					<MemoryDisplay cpu={cpu} stackPointer={cpuState.generalRegisters.ESP} />

					<StatisticsDisplay statistics={statistics} />
				</frame>
			</frame>
		</frame>
	);
}
