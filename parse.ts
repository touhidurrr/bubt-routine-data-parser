import { format } from "bytes";
import { JSDOM } from "jsdom";

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
  intake: string;
  section: string;
  semester: string;
  classes: (Class | null)[][]; // 7 days (SAT to FRI), 8 periods
};

const routines: Routine[] = [];

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
    intake: "",
    section: "",
    semester: "",
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
  routine.intake = intakeText.trim();
  routine.section = sectionText.trim();

  routine.program = programText.slice(programText.indexOf(":") + 1).trim();
  routine.semester = semesterText.slice(semesterText.indexOf(":") + 1).trim();

  // parse routineTable
  const routineTableTrs = [...routineTable.getElementsByTagName("tr")];

  routineTableTrs.shift(); // Remove the header row
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
  courseCodeToTitleMap,
  facultyIdToNameMap,
  routines,
};

const jsonText = JSON.stringify(data, null, 2);

await Bun.write(dataPath, JSON.stringify(data, null, 2));

console.log(`Saved parsed json to ${dataPath} (${format(jsonText.length)})`);
