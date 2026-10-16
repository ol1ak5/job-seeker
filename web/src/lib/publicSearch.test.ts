import { describe, expect, it } from "vitest";

import {
  fromJsearch,
  isSearchCountry,
  jsearchJobs,
  jsearchQuery,
  parsePlace,
  sourceFor,
} from "./publicSearch";
import { COUNTRIES } from "./tracks";

describe("which source a country uses", () => {
  it("keeps every Adzuna market on Adzuna", () => {
    for (const { code } of COUNTRIES) {
      expect(isSearchCountry(code)).toBe(true);
      expect(sourceFor(code)).toBe("adzuna");
    }
  });

  it("sends countries Adzuna does not index to JSearch", () => {
    expect(sourceFor("pt")).toBe("jsearch");
    expect(sourceFor("ar")).toBe("jsearch");
  });

  it("refuses codes that are not countries", () => {
    expect(isSearchCountry("xx")).toBe(false);
    expect(isSearchCountry("")).toBe(false);
  });
});

describe("reading the place box", () => {
  it("takes a city on its own as a place in Spain", () => {
    expect(parsePlace("Madrid")).toEqual({ country: "es", where: "Madrid" });
    expect(parsePlace("Málaga")).toEqual({ country: "es", where: "Málaga" });
    expect(parsePlace("")).toEqual({ country: "es", where: "" });
  });

  it("recognises a country by its English or Spanish name", () => {
    expect(parsePlace("Portugal")).toEqual({ country: "pt", where: "" });
    expect(parsePlace("Alemania")).toEqual({ country: "de", where: "" });
    expect(parsePlace("united kingdom")).toEqual({ country: "gb", where: "" });
    expect(parsePlace("UK")).toEqual({ country: "gb", where: "" });
  });

  it("splits a city and a country", () => {
    expect(parsePlace("Lisbon, Portugal")).toEqual({ country: "pt", where: "Lisbon" });
    expect(parsePlace("Bilbao, España")).toEqual({ country: "es", where: "Bilbao" });
  });

  it("knows the big cities of other markets", () => {
    expect(parsePlace("London")).toEqual({ country: "gb", where: "London" });
    expect(parsePlace("münchen")).toEqual({ country: "de", where: "münchen" });
  });
});

describe("JSearch results", () => {
  it("puts the place into the query, as somebody would type it into Google", () => {
    expect(jsearchQuery("data analyst", "Lisbon")).toBe("data analyst in Lisbon");
    expect(jsearchQuery("data analyst", "")).toBe("data analyst");
  });

  it("reads both shapes the API has answered with", () => {
    const job = { job_title: "Analyst" };
    expect(jsearchJobs({ data: [job] })).toEqual([job]);
    expect(jsearchJobs({ data: { jobs: [job] } })).toEqual([job]);
    expect(jsearchJobs({})).toEqual([]);
  });

  it("maps a job into the same shape as an Adzuna result", () => {
    const vacancy = fromJsearch(
      {
        job_id: "abc",
        job_title: "Energy <b>Analyst</b>",
        employer_name: "",
        job_city: "Lisbon",
        job_state: null,
        job_country: "PT",
        job_posted_at_datetime_utc: "2026-10-01T09:00:00.000Z",
        job_min_salary: 30000,
        job_max_salary: 42000.4,
        job_apply_link: "https://example.com/apply",
        job_description: "Power   markets\nand forecasting",
      },
      0,
    );
    expect(vacancy).toEqual({
      id: "abc",
      title: "Energy Analyst",
      company: "Unknown",
      location: "Lisbon, PT",
      posted: "2026-10-01",
      salary: "30000-42000",
      url: "https://example.com/apply",
      snippet: "Power markets and forecasting",
    });
  });
});
