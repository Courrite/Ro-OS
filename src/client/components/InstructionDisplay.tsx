import React, { useMemo } from "@rbxts/react";
import { CPU } from "shared/cpu/CPU";
import { Instruction } from "shared/cpu/types";

interface InstructionDisplayProps {
	cpu: CPU;
	currentAddress: number;
	isHalted: boolean;
}

export function InstructionDisplay({ cpu, currentAddress, isHalted }: InstructionDisplayProps) {
	const instructions = useMemo(() => {
		const instrs: Array<{ address: number; instruction: Instruction | undefined }> = [];
		let addr = currentAddress;

		// Get next 10 instructions
		for (let i = 0; i < 10; i++) {
			try {
				const instruction = cpu.getDecoder().decodeInstruction(addr);
				instrs.push({ address: addr, instruction });
				addr += instruction.size;
			} catch {
				instrs.push({ address: addr, instruction: undefined });
				addr += 1;
			}
		}

		return instrs;
	}, [cpu, currentAddress]);

	return (
		<frame Size={UDim2.fromScale(1, 1)} BackgroundTransparency={1}>
			<uipadding
				PaddingLeft={new UDim(0, 10)}
				PaddingRight={new UDim(0, 10)}
				PaddingTop={new UDim(0, 10)}
				PaddingBottom={new UDim(0, 10)}
			/>

			<textlabel
				Text="Instruction Stream"
				Size={new UDim2(1, 0, 0, 25)}
				TextColor3={new Color3(1, 1, 1)}
				BackgroundTransparency={1}
				Font={Enum.Font.SourceSansBold}
				TextXAlignment={Enum.TextXAlignment.Left}
			/>

			{isHalted && (
				<textlabel
					Text="[CPU HALTED]"
					Size={new UDim2(1, 0, 0, 20)}
					Position={new UDim2(0, 0, 0, 30)}
					TextColor3={new Color3(1, 0, 0)}
					BackgroundTransparency={1}
					Font={Enum.Font.SourceSansBold}
					TextXAlignment={Enum.TextXAlignment.Center}
				/>
			)}

			<scrollingframe
				Size={new UDim2(1, 0, 1, -60)}
				Position={new UDim2(0, 0, 0, 60)}
				BackgroundColor3={new Color3(0.1, 0.1, 0.1)}
				BorderSizePixel={0}
				ScrollBarThickness={4}
				CanvasSize={new UDim2(0, 0, 0, instructions.size() * 25)}
			>
				<uilistlayout Padding={new UDim(0, 2)} SortOrder={Enum.SortOrder.LayoutOrder} />

				{instructions.map(({ address, instruction }, index) => {
					const isCurrent = index === 0;
					const text = instruction
						? `${string.format("0x%04X", address)}: ${instruction.mnemonic} ${formatOperands(instruction)}`
						: `${string.format("0x%04X", address)}: ???`;

					return (
						<frame
							key={tostring(address)}
							Size={new UDim2(1, -5, 0, 23)}
							BackgroundColor3={isCurrent ? new Color3(0.2, 0.4, 0.8) : new Color3(0.15, 0.15, 0.15)}
							BackgroundTransparency={isCurrent ? 0 : 0.5}
						>
							<uicorner CornerRadius={new UDim(0, 3)} />
							<textlabel
								Text={text}
								Size={UDim2.fromScale(1, 1)}
								Position={new UDim2(0, 5, 0, 0)}
								TextColor3={isCurrent ? new Color3(1, 1, 1) : new Color3(0.8, 0.8, 0.8)}
								BackgroundTransparency={1}
								TextXAlignment={Enum.TextXAlignment.Left}
								Font={Enum.Font.Code}
							>
								{isCurrent && (
									<textlabel
										Text="▶"
										Size={new UDim2(0, 20, 1, 0)}
										Position={new UDim2(0, -25, 0, 0)}
										TextColor3={new Color3(1, 1, 0)}
										BackgroundTransparency={1}
										TextXAlignment={Enum.TextXAlignment.Center}
										Font={Enum.Font.SourceSansBold}
									/>
								)}
							</textlabel>
						</frame>
					);
				})}
			</scrollingframe>
		</frame>
	);
}

function formatOperands(instruction: Instruction): string {
	return instruction.operands
		.map((operand) => {
			if (operand.register !== undefined) {
				if (operand.displacement !== undefined) {
					return `[${operand.register}+${string.format("0x%X", operand.displacement)}]`;
				}
				return operand.type === 3 ? `[${operand.register}]` : operand.register;
			}
			return string.format("0x%X", operand.value);
		})
		.join(", ");
}
