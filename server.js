const e = require("express");
const f = require("fs");

const a = e();
a.use(e.json());

a.get("/data", (q, s) => {
  f.readFile("data.json", "utf8", (x, d) => {
    if (x) return s.status(500).send("Error reading file");
    s.json(JSON.parse(d));
  });
});

a.post("/post", (q, s) => {
  f.readFile("data.json", "utf8", (x, d) => {
    if (x) return s.status(500).send("Error reading file");

    const j = JSON.parse(d);
    j.push(q.body);

    f.writeFile("data.json", JSON.stringify(j, null, 2), (x) => {
      if (x) return s.status(500).send("Error writing file");
      s.status(201).json(q.body);
    });
  });
});

a.listen(3000, () => console.log("Server running on port 3000"));