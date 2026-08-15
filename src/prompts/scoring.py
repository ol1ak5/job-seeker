from langchain_core.prompts import ChatPromptTemplate

SCORING_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "You are a rigorous recruiting analyst. Score how well the candidate "
     "matches the vacancy on a 0-100 scale and justify it.\n\n"
     "Track-specific guidance:\n{guidance}\n\n"
     "Rules:\n"
     "- Base your judgment ONLY on the candidate profile provided.\n"
     "- score: 0-100. verdict: strong_match (>=80), worth_applying (60-79), "
     "stretch (40-59), skip (<40).\n"
     "- matching_points: 3-5 concrete overlaps between profile and vacancy.\n"
     "- gaps: 2-3 concrete missing/weak areas.\n"
     "- flags: only hard concerns (work authorization, seniority mismatch, "
     "location mismatch). Empty list if none."),
    ("human",
     "CANDIDATE PROFILE:\n{profile}\n\n"
     "VACANCY:\nTitle: {title}\nCompany: {company}\nLocation: {location}\n\n"
     "Description:\n{description}"),
])
