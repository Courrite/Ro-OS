import React from "@rbxts/react";
import { CPUStatistics } from "shared/cpu/types";

interface StatisticsDisplayProps {
	statistics: CPUStatistics;
}

export function StatisticsDisplay({ statistics }: StatisticsDisplayProps) {
	const entries: Array<[string, number]> = [];
	for (const [key, value] of pairs(statistics)) {
		entries.push([key, value]);
	}

	return (
		<frame Size={UDim2.fromScale(1, 0.25)} BackgroundTransparency={1}>
			<uipadding
				PaddingLeft={new UDim(0, 5)}
				PaddingRight={new UDim(0, 5)}
				PaddingTop={new UDim(0, 5)}
				PaddingBottom={new UDim(0, 5)}
			/>

			<uilistlayout Padding={new UDim(0, 5)} SortOrder={Enum.SortOrder.LayoutOrder} />

			<textlabel
				Text="CPU Statistics"
				Size={new UDim2(1, 0, 0, 20)}
				TextColor3={new Color3(1, 1, 1)}
				BackgroundTransparency={1}
				Font={Enum.Font.SourceSansBold}
				TextXAlignment={Enum.TextXAlignment.Left}
			/>

			{entries.map(([key, value]) => (
				<textlabel
					key={key}
					Text={`${key}: ${value}`}
					Size={new UDim2(1, 0, 0, 20)}
					TextColor3={new Color3(1, 1, 1)}
					BackgroundTransparency={1}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>
			))}
		</frame>
	);
}
