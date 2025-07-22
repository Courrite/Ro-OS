import React from "@rbxts/react";
import { CPUFlags } from "shared/cpu/types";

interface FlagsDisplayProps {
	flags: CPUFlags;
}

export function FlagsDisplay({ flags }: FlagsDisplayProps) {
	const flagDescriptions = {
		CF: "Carry Flag",
		PF: "Parity Flag",
		AF: "Auxiliary Flag",
		ZF: "Zero Flag",
		SF: "Sign Flag",
		TF: "Trap Flag",
		IF: "Interrupt Flag",
		DF: "Direction Flag",
		OF: "Overflow Flag",
	};

	const entries: Array<[string, boolean]> = [];
	for (const [key, value] of pairs(flags)) {
		entries.push([key, value]);
	}

	return (
		<frame Size={UDim2.fromScale(1, 0.4)} BackgroundTransparency={1}>
			<uipadding
				PaddingLeft={new UDim(0, 5)}
				PaddingRight={new UDim(0, 5)}
				PaddingTop={new UDim(0, 5)}
				PaddingBottom={new UDim(0, 5)}
			/>

			<textlabel
				Text="CPU Flags"
				Size={new UDim2(1, 0, 0, 20)}
				TextColor3={new Color3(1, 1, 1)}
				BackgroundTransparency={1}
				Font={Enum.Font.SourceSansBold}
				TextXAlignment={Enum.TextXAlignment.Left}
			/>

			<frame Size={new UDim2(1, 0, 1, -25)} Position={new UDim2(0, 0, 0, 25)} BackgroundTransparency={1}>
				<uigridlayout
					CellSize={new UDim2(0.5, -5, 0, 20)}
					CellPadding={new UDim2(0, 5, 0, 5)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>

				{entries.map(([flagName, value]) => (
					<frame key={flagName} BackgroundTransparency={1}>
						<textlabel
							Text={`${flagName}:`}
							Size={new UDim2(0.3, 0, 1, 0)}
							TextColor3={new Color3(0.8, 0.8, 0.8)}
							BackgroundTransparency={1}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<frame
							Size={new UDim2(0, 20, 0, 20)}
							Position={new UDim2(0.35, 0, 0, 0)}
							BackgroundColor3={value ? new Color3(0, 1, 0) : new Color3(0.3, 0.3, 0.3)}
							BorderSizePixel={0}
						>
							<uicorner CornerRadius={new UDim(0, 3)} />
						</frame>
						<textlabel
							Text={flagDescriptions[flagName as keyof typeof flagDescriptions]}
							Size={new UDim2(0.5, 0, 1, 0)}
							Position={new UDim2(0.5, 0, 0, 0)}
							TextColor3={new Color3(0.7, 0.7, 0.7)}
							BackgroundTransparency={1}
							TextXAlignment={Enum.TextXAlignment.Left}
							TextScaled={true}
						/>
					</frame>
				))}
			</frame>
		</frame>
	);
}
