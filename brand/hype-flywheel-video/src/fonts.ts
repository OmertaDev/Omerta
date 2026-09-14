import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

void loadFont({
  family: "Omerta Display",
  url: staticFile("art/display.woff2"),
  format: "woff2",
  weight: "700",
  display: "block",
});
