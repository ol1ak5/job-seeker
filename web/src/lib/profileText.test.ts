import { describe, expect, it } from "vitest";

import { agentText, currentSectionText, generatedText, sectionText } from "./profileText";

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

  it("puts a corrected section in place of the one read, and leaves the rest", () => {
    const corrected = { ...PROFILE, section_edits: { Languages: "Spanish · English · French" } };
    expect(agentText(corrected)).toBe(
      generatedText(PROFILE).replace("Spanish · English", "Spanish · English · French"),
    );
    expect(currentSectionText(corrected, PROFILE.sections[2])).toBe("Spanish · English · French");
    expect(currentSectionText({ ...PROFILE, section_edits: { Languages: "  " } }, PROFILE.sections[2])).toBe(
      sectionText(PROFILE.sections[2]),
    );
  });
});
