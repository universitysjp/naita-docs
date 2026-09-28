import { setTimeout as delay } from "node:timers/promises";

let prompt = "";
for await (const chunk of process.stdin) {
  prompt += chunk;
}
if (process.argv[2] === "fail") {
  console.error("Deliberate test agent failure");
  process.exitCode = 1;
} else if (process.argv[2] === "malformed") {
  console.log("This is not a JSON response.");
} else {
  const weeks = JSON.parse(prompt.split("Source material:\n")[1]);
  const [week] = weeks;
  const [commit] = week.days.flatMap((day) => day.commits);
  await delay(50);
  console.log(
    JSON.stringify({
      weeks: [
        {
          monday: week.monday,
          suggestions: [
            {
              evidence: [commit.hash],
              kind: "draft",
              reason: "The commit records search by title.",
              section: "work",
              text: "Added a task search box.",
            },
          ],
        },
      ],
    })
  );
}
