import { parseFontesDate } from "../../../lib/ReactViews/Fontes/Fontes";

describe("Fontes", function () {
  describe("parseFontesDate", function () {
    it("expands certain dates to the days they cover", function () {
      expect(parseFontesDate("1985-04-12")).toEqual({
        start: "1985-04-12",
        end: "1985-04-12"
      });
      expect(parseFontesDate("1985-04")).toEqual({
        start: "1985-04-01",
        end: "1985-04-30"
      });
      expect(parseFontesDate("1985")).toEqual({
        start: "1985-01-01",
        end: "1985-12-31"
      });
    });

    it("ends February on the right day in leap and common years", function () {
      expect(parseFontesDate("2004-02")?.end).toEqual("2004-02-29");
      expect(parseFontesDate("2000-02")?.end).toEqual("2000-02-29");
      expect(parseFontesDate("1900-02")?.end).toEqual("1900-02-28");
      expect(parseFontesDate("1627-02")?.end).toEqual("1627-02-28");
    });

    it("keeps the range of uncertain dates", function () {
      expect(parseFontesDate("1985-04-12?")).toEqual({
        start: "1985-04-12",
        end: "1985-04-12"
      });
      expect(parseFontesDate("1985-04?")).toEqual({
        start: "1985-04-01",
        end: "1985-04-30"
      });
      expect(parseFontesDate("1985?")).toEqual({
        start: "1985-01-01",
        end: "1985-12-31"
      });
    });

    it("turns imprecise years into the decade or century they cover", function () {
      expect(parseFontesDate("198X")).toEqual({
        start: "1980-01-01",
        end: "1989-12-31"
      });
      expect(parseFontesDate("19XX")).toEqual({
        start: "1900-01-01",
        end: "1999-12-31"
      });
    });

    it("completes both ends of a date interval", function () {
      expect(parseFontesDate("1964/2008")).toEqual({
        start: "1964-01-01",
        end: "2008-12-31"
      });
      expect(parseFontesDate("2004-06/2006-08")).toEqual({
        start: "2004-06-01",
        end: "2006-08-31"
      });
      expect(parseFontesDate("2004-02-01/2005-02-08")).toEqual({
        start: "2004-02-01",
        end: "2005-02-08"
      });
      expect(parseFontesDate("2004-02-01/2005-02")).toEqual({
        start: "2004-02-01",
        end: "2005-02-28"
      });
      expect(parseFontesDate("2004-02-01/2005")).toEqual({
        start: "2004-02-01",
        end: "2005-12-31"
      });
      expect(parseFontesDate("2005/2006-02")).toEqual({
        start: "2005-01-01",
        end: "2006-02-28"
      });
    });

    it("leaves the start open for ante quem dates", function () {
      expect(parseFontesDate("/1985-04-12")).toEqual({
        start: undefined,
        end: "1985-04-12"
      });
      expect(parseFontesDate("/1985-04")?.end).toEqual("1985-04-30");
      expect(parseFontesDate("/1985")?.end).toEqual("1985-12-31");
    });

    it("leaves the end open for post quem dates", function () {
      expect(parseFontesDate("1985-04-12/")).toEqual({
        start: "1985-04-12",
        end: undefined
      });
      expect(parseFontesDate("1985-04/")?.start).toEqual("1985-04-01");
      expect(parseFontesDate("1985/")?.start).toEqual("1985-01-01");
    });

    it("ignores surrounding spaces", function () {
      expect(parseFontesDate(" 1985 ")?.start).toEqual("1985-01-01");
    });

    it("rejects what the QGIS plugin rejects", function () {
      [
        "",
        "abc",
        "0985",
        "3000",
        "1985-13",
        "1985-00",
        "1985-04-32",
        "198XX",
        "1X",
        "1985?/1990",
        "/",
        "1985//1990"
      ].forEach((text) =>
        expect(parseFontesDate(text)).withContext(text).toBeUndefined()
      );
    });

    it("rejects intervals that do not move forward", function () {
      expect(parseFontesDate("1985/1984")).toBeUndefined();
      expect(parseFontesDate("1985/1985")).toBeUndefined();
      expect(parseFontesDate("2005-06/2005")).toBeUndefined();
    });

    it("rejects days that do not exist in the calendar", function () {
      expect(parseFontesDate("2004-02-30")).toBeUndefined();
      expect(parseFontesDate("1900-02-29")).toBeUndefined();
      expect(parseFontesDate("2004-04-31/2005")).toBeUndefined();
    });
  });
});
