import { format as formatBytes } from "bytes";
import { JSDOM } from "jsdom";
import { format as prettierFormat } from "prettier";

const htmlText = await Bun.file("data/routine.php.html").text();
const { document } = new JSDOM(htmlText).window;

const routineInfoTables = [
  ...document.querySelectorAll("table[id=HdtableRtn]"),
] as HTMLTableElement[];
const routineTables = [
  ...document.querySelectorAll("table[id=tableRtn]"),
] as HTMLTableElement[];
const routineFooterTables = [
  ...document.querySelectorAll("table.tb"),
] as HTMLTableElement[];

const dataLength = Math.min(
  routineInfoTables.length,
  routineTables.length,
  routineFooterTables.length,
);

const programs: {
  [programName: string]: {
    [intake: number]: string[];
  };
} = {};

const courseCodeToTitleMap: { [courseCode: string]: string } = {};
const facultyIdToNameMap: { [facultyCode: string]: string } = {};

type Class = {
  courseCode: string;
  facultyCode: string;
  building: string;
  room: string;
};

type Routine = {
  program: string;
  intake: number;
  section: string;
  semester: string;
  periods: string[];
  classes: (Class | null)[][]; // 7 days (SAT to FRI), 8 periods
};

const routines: Routine[] = [];

function sanitizeText(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim();
}

function addRoutineDataToPrograms(routine: Routine) {
  if (!programs[routine.program]) {
    programs[routine.program] = {
      [routine.intake]: [routine.section],
    };
    return;
  }

  if (!programs[routine.program][routine.intake]) {
    programs[routine.program][routine.intake] = [routine.section];
    return;
  }

  programs[routine.program][routine.intake].push(routine.section);
}

for (let i = 0; i < dataLength; i++) {
  const routineInfoTable = routineInfoTables[i];
  const routineTable = routineTables[i];
  const routineFooterTable = routineFooterTables[i];

  // parse routineInfoTable
  const routineFooterTrs = [...routineFooterTable.getElementsByTagName("tr")];

  routineFooterTrs.shift(); // Remove the header row
  routineFooterTrs.forEach((tr) => {
    const [courseCode, courseTitle, facultyCode, facultyName] = [
      ...tr.getElementsByTagName("td"),
    ].map((td) => td.textContent?.trim());
    courseCodeToTitleMap[courseCode!] = courseTitle!;
    facultyIdToNameMap[facultyCode!] = facultyName!;
  });

  // make base routine object
  const routine: Routine = {
    program: "",
    intake: NaN,
    section: "",
    semester: "",
    periods: [],
    classes: [],
  };

  // parse routineInfoTable
  const [, programText, intakeSectionText, semesterText] = [
    ...routineInfoTable.getElementsByTagName("td"),
  ].map((td) => td.textContent!.trim());

  const [intakeText, sectionText] = intakeSectionText
    .slice(intakeSectionText.indexOf(":") + 1)
    .trim()
    .split("-");

  routine.intake = parseInt(intakeText.trim());
  routine.section = sanitizeText(sectionText);

  routine.program = programText.slice(programText.indexOf(":") + 1).trim();
  routine.semester = semesterText.slice(semesterText.indexOf(":") + 1).trim();

  addRoutineDataToPrograms(routine);

  // parse routineTable
  const routineTableTrs = [...routineTable.getElementsByTagName("tr")];

  const periodThs = [...routineTableTrs.shift()!.getElementsByTagName("th")];
  periodThs.shift(); // Remove the first cell
  routine.periods = periodThs.map((th) => sanitizeText(th.textContent || ""));

  routine.classes = routineTableTrs.map((tr) => {
    const tds = [...tr.getElementsByTagName("td")];
    return tds.map((td) => {
      const cellText = td.textContent?.trim();
      if (!cellText) return null;

      const fcIndex = cellText.indexOf("FC:");
      const bIndex = cellText.indexOf("B:");

      const courseCode = cellText.slice(0, fcIndex);
      const facultyCode = cellText.slice(fcIndex + 3, bIndex).trim();

      const [building, room] = cellText
        .slice(bIndex)
        .split("⇒")
        .map((text) => text.slice(text.indexOf(":") + 1).trim());

      return { courseCode, facultyCode, building, room };
    });
  });

  routines.push(routine);
}

const dataPath = "data/routines.json";
const data = {
  updated: new Date(),
  programs,
  courseCodeToTitleMap,
  facultyIdToNameMap,
  routines,
};

const jsonText = await prettierFormat(JSON.stringify(data), { parser: "json" });

await Bun.write(dataPath, jsonText);

console.log(
  `Saved parsed json to ${dataPath} (${formatBytes(jsonText.length)})`,
);
