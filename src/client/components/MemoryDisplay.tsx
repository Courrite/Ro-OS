import React, { useMemo } from "@rbxts/react";
import { CPU } from "shared/cpu/CPU";

interface MemoryDisplayProps {
	cpu: CPU;
	stackPointer: number;
}

export function MemoryDisplay({ cpu, stackPointer }: MemoryDisplayProps) {
	const memoryView = useMemo(() => {
		const view: Array<{ address: number; value: number }> = [];
		const startAddress = math.max(0, stackPointer - 32);
		const endAddress = math.min(0xffff, stackPointer + 32);

		for (let addr = startAddress; addr <= endAddress; addr += 4) {
			try {
				const value = cpu.getMMU().readDWord(addr);
				view.push({ address: addr, value });
			} catch {
				view.push({ address: addr, value: 0 });
			}
		}

		return view;
	}, [cpu, stackPointer]);

	return (
		<frame Size={UDim2.fromScale(1, 0.5)} BackgroundTransparency={1}>
			<uipadding
				PaddingLeft={new UDim(0, 5)}
				PaddingRight={new UDim(0, 5)}
				PaddingTop={new UDim(0, 5)}
				PaddingBottom={new UDim(0, 5)}
			/>

			<textlabel
				Text="Memory View (Stack Region)"
				Size={new UDim2(1, 0, 0, 20)}
				TextColor3={new Color3(1, 1, 1)}
				BackgroundTransparency={1}
				Font={Enum.Font.SourceSansBold}
				TextXAlignment={Enum.TextXAlignment.Left}
			/>

			<scrollingframe
				Size={new UDim2(1, 0, 1, -25)}
				Position={new UDim2(0, 0, 0, 25)}
				BackgroundColor3={new Color3(0.1, 0.1, 0.1)}
				BorderSizePixel={0}
				ScrollBarThickness={4}
				CanvasSize={new UDim2(0, 0, 0, memoryView.size() * 20)}
			>
				<uilistlayout Padding={new UDim(0, 2)} SortOrder={Enum.SortOrder.LayoutOrder} />

				{memoryView.map(({ address, value }) => (
					<textlabel
						key={tostring(address)}
						Text={`${string.format("0x%04X", address)}: ${string.format("0x%08X", value)}${address === stackPointer ? " <- ESP" : ""}`}
						Size={new UDim2(1, -5, 0, 18)}
						TextColor3={address === stackPointer ? new Color3(1, 1, 0) : new Color3(0.8, 0.8, 0.8)}
						BackgroundColor3={
							address === stackPointer ? new Color3(0.3, 0.3, 0) : new Color3(0.15, 0.15, 0.15)
						}
						BackgroundTransparency={address === stackPointer ? 0.5 : 0.8}
						TextXAlignment={Enum.TextXAlignment.Left}
						Font={Enum.Font.Code}
					/>
				))}
			</scrollingframe>
		</frame>
	);
}
