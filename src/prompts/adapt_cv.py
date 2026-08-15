from langchain_core.prompts import ChatPromptTemplate

SECTION_ORDER = {
    "energy": "Contact line, Headline, Work Experience (with Selected "
              "Transactions), Languages, Skills, Education, Certifications",
    "ai": "Contact line, Headline, Work Experience, Languages, Skills, "
          "Education, Certifications (grouped: Professional certifications / "
          "Courses / Hackathons), Projects & Hackathons",
}

ADAPT_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "You are an expert CV writer. Produce a complete, ready-to-send CV in "
     "clean Markdown, tailored to the vacancy below.\n\n"
     "HARD RULES:\n"
     "- NEVER invent facts, metrics, skills, employers, dates or experience "
     "not present in the candidate profile. You may only re-order, "
     "re-emphasize, select and re-phrase existing content.\n"
     "- Keep it to one page worth of content.\n"
     "- English only.\n"
     "- Use the XYZ style (accomplished X, measured by Y, by doing Z) where "
     "the profile provides metrics; omit numbers where it does not.\n"
     "- Contact line: location | phone | email as mailto link | LinkedIn | "
     "GitHub, each as Markdown links where applicable.\n"
     "- Section order for this track ({track}): {section_order}\n"
     "- Skills section: keep the profile's category lines and order, starting "
     "with Databases/Market Data.\n"
     "- Emphasize the profile content most relevant to this vacancy; trim "
     "the least relevant bullets rather than shortening all of them."),
    ("human",
     "CANDIDATE PROFILE:\n{profile}\n\n"
     "TARGET VACANCY:\nTitle: {title}\nCompany: {company}\n\n"
     "Description:\n{description}\n\n"
     "Write the full CV now. Output only the CV Markdown, no commentary."),
])
