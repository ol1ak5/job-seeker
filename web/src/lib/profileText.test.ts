import { describe, expect, it } from "vitest";

import { agentText, generatedText } from "./profileText";

const PROFILE = {
  contact: { name: "Ana Garcia", details: ["Madrid, Spain", "ana@example.com"] },
  headline: { variants: { energy: "Energy analyst" } },
  sections: [
    {
      title: "Experience",
      type: "entries",
      items: [
        {
          heading: "Analyst - Example Power",
          subheading: "Madrid",
          dates: "2023-2026",
          bullets: [{ default: "Built price forecasts for {metric} markets", metric: "3" }],
        },
      ],
    },
    { title: "Skills", type: "categories", items: [{ label: "Tools", values: ["Python", "SQL"] }] },
    { title: "Languages", type: "inline", items: ["Spanish", "English"] },
    { title: "Education", type: "list", items: [{ text: "MSc Energy", dates: "2022" }] },
  ],
};

describe("the text the agent reads", () => {
  it("renders every section the way the Python engine does", () => {
    expect(generatedText(PROFILE)).toBe(
      [
        "# Ana Garcia",
        "**Energy analyst**",
        "Madrid, Spain · ana@example.com",
        "\n## Experience",
        "\n### Analyst - Example Power",
        "*Madrid* *2023-2026*",
        "- Built price forecasts for 3 markets",
        "\n## Skills",
        "- **Tools:** Python, SQL",
        "\n## Languages",
        "Spanish · English",
        "\n## Education",
        "- MSc Energy | *2022*",
      ].join("\n"),
    );
  });

  it("uses your correction when there is one, and the generated text when it is blank", () => {
    expect(agentText({ ...PROFILE, edited_text: "  My own version  " })).toBe("My own version");
    expect(agentText({ ...PROFILE, edited_text: "   " })).toBe(generatedText(PROFILE));
  });
});
