import { describe, expect, it } from "vitest";
import { CENTRE_DATASETS, summariseRows } from "@/lib/drive-datasets";

describe("drive dataset counts", () => {
  it("counts non-empty rows after the header", () => {
    expect(summariseRows([["ID", "Name"], ["1", "A"], [], ["2", ""]]).records).toBe(2);
  });
  it("reports filled-cell completeness", () => {
    expect(
      summariseRows([
        ["ID", "Name"],
        ["1", "A"],
        ["2", ""],
      ]).completeness,
    ).toBe(75);
  });
  it("uses the individually shared Kochi Google Sheet", () => {
    expect(CENTRE_DATASETS["Amrita Kochi"]).toMatchObject({
      fileId: "1Yvfmdck7fW4UcdyaMpBP0WTzPtQFy07XVCN4wYw0Yvs",
      fileName: "Amrita_Kochi_Dataset",
      googleSheet: true,
    });
  });
});
