import React from "@rbxts/react";
import { createRoot } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { CPU } from "shared/cpu/CPU";
import { CPUVisualizer } from "./components/CPUVisualizer";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

const screenGui = new Instance("ScreenGui");
screenGui.Name = "CPUVisualizer";
screenGui.ResetOnSpawn = false;
screenGui.Parent = playerGui;
screenGui.IgnoreGuiInset = true;

const cpu = new CPU(65536);

const root = createRoot(screenGui);
root.render(React.createElement(CPUVisualizer, { cpu: cpu }));

print("initialized the ui!");
