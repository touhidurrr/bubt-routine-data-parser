import { format } from "bytes";

const routineDataURL = "https://annex.bubt.edu.bd/global_file/routine.php";
const routineDataPath = "data/routine.php.html";

const htmlText = await fetch(routineDataURL).then((res) => res.text());
await Bun.write(routineDataPath, htmlText);

console.log(
  `Saved routine data to ${routineDataPath} (${format(htmlText.length)})`,
);
