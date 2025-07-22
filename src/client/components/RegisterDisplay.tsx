import React from "@rbxts/react";
import { GeneralRegisters, InstructionPointer } from "shared/cpu/types";

interface RegisterDisplayProps {
	generalRegisters: GeneralRegisters;
	instructionPointer: InstructionPointer;
}

export function RegisterDisplay({ generalRegisters, instructionPointer }: RegisterDisplayProps) {
	const entries: Array<[string, number]> = [];
	for (const [key, value] of pairs(generalRegisters)) {
		entries.push([key, value]);
	}

	return (
		<frame Size={UDim2.fromScale(1, 0.5)} BackgroundTransparency={1}>
			<uipadding
				PaddingLeft={new UDim(0, 5)}
				PaddingRight={new UDim(0, 5)}
				PaddingTop={new UDim(0, 5)}
				PaddingBottom={new UDim(0, 5)}
			/>

			<uilistlayout Padding={new UDim(0, 5)} SortOrder={Enum.SortOrder.LayoutOrder} />

			{entries.map(([name, value]) => (
				<textlabel
					key={name}
					Text={`${name}: ${string.format("0x%08X", value)}`}
					Size={new UDim2(1, 0, 0, 20)}
					TextColor3={new Color3(1, 1, 1)}
					BackgroundTransparency={1}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
			))}

			<textlabel
				Text={`EIP: ${string.format("0x%08X", instructionPointer.EIP)}`}
				Size={new UDim2(1, 0, 0, 20)}
				TextColor3={new Color3(1, 1, 1)}
				BackgroundTransparency={1}
				TextXAlignment={Enum.TextXAlignment.Left}
			/>
		</frame>
	);
}
