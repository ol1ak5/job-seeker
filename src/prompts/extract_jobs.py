from langchain_core.prompts import ChatPromptTemplate

EXTRACT_JOBS_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "You extract job vacancies from the text of a web page. Return ONLY a JSON "
     "array, no markdown fences and no commentary.\n"
     "Each element: {{\"title\": str, \"company\": str, \"location\": str, "
     "\"description\": str, \"url\": str or null}}.\n"
     "Rules:\n"
     "- Include only real, currently advertised vacancies found in the text.\n"
     "- Never invent a company, location or requirement that is not written there.\n"
     "- A listing page may contain several vacancies: return all of them.\n"
     "- If the page advertises no vacancy, return an empty array []."),
    ("human", "PAGE URL: {url}\nPAGE TITLE: {title}\n\nPAGE TEXT:\n{content}"),
])
