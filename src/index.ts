import { Box, Text, createCliRenderer } from "@opentui/core"

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
})

renderer.root.add(
  Box(
    {
      width: "100%",
      height: "100%",
      padding: 1,
      flexDirection: "column",
      gap: 1,
      backgroundColor: "#111827",
    },
    Text({
      content: "Gitty",
      fg: "#7DD3FC",
    }),
    Box(
      {
        borderStyle: "rounded",
        padding: 1,
        flexDirection: "column",
        gap: 1,
      },
      Text({
        content: "OpenTUI is ready.",
        fg: "#86EFAC",
      }),
      Text({
        content: "Edit src/index.ts to build your terminal UI.",
        fg: "#E5E7EB",
      }),
      Text({
        content: "Press Ctrl+C to exit.",
        fg: "#FDE68A",
      }),
    ),
  ),
)
