from langchain_core.prompts import ChatPromptTemplate

IMPORT_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "You convert a CV into a structured profile. Output ONLY data that "
     "appears in the CV — never invent employers, dates, metrics, skills or "
     "qualifications. Omit anything the CV does not state.\n\n"
     "Schema:\n"
     "- contact: {{name, details: [strings — location, phone, email, links]}}\n"
     "- headline: {{variants: {{<track>: '<one-line positioning>'}}}} for each "
     "of these tracks: {tracks}\n"
     "- sections: ordered list; each {{title, type, items, tracks?}} where type is:\n"
     "  * entries  — jobs/projects: items have heading, subheading?, dates?, "
     "bullets[{{default: text}}], subitems?\n"
     "  * categories — skills: items have label and values[]\n"
     "  * inline   — one line joined by dots: items are plain strings\n"
     "  * list     — certifications/education: items have text and dates?\n"
     "  * text     — paragraphs: items are plain strings\n"
     "Use the CV's own section titles and order. Put a job's location in "
     "subheading and its period in dates. If a section belongs to only some "
     "tracks, add tracks: [..] to it."),
    ("human", "CV TEXT:\n{cv_text}\n\nProduce the profile now."),
])
