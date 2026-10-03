let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];
function searchNotes(word) {
  return notes.filter(note =>
    note.text.toLowerCase().includes(word.toLowerCase())
  );
}
function longestNote() {
  if (notes.length === 0) {
    return null;
  }

  return notes.reduce((longest, note) =>
    note.text.length > longest.text.length ? note : longest
  );
}
function countByCategory() {
  const counts = {};

  notes.forEach(note => {
    if (counts[note.category]) {
      counts[note.category]++;
    } else {
      counts[note.category] = 1;
    }
  });

  return counts;
}
function getSummary() {
  const counts = countByCategory();

  return `${notes.length} notes: ${counts.personal || 0} personal, ${counts.work || 0} work, ${counts.study || 0} study.`;
}
function isDuplicate(text) {
  const normalizedText = text.trim().replace(/\s+/g, " ").toLowerCase();

  return notes.some(note =>
    note.text.trim().replace(/\s+/g, " ").toLowerCase() === normalizedText
  );
}
function addNote(text, category) {
  const trimmedText = text.trim();
  const validCategories = ["personal", "work", "study"];

  if (trimmedText.length < 1 || trimmedText.length > 200) {
    console.log("Note must be between 1 and 200 characters.");
    return false;
  }

  if (isDuplicate(trimmedText)) {
    console.log("Duplicate note. Note was not added.");
    return false;
  }

  if (!validCategories.includes(category)) {
    console.log("Invalid category. Use personal, work or study.");
    return false;
  }

  const nextId = notes.length > 0
    ? Math.max(...notes.map(note => note.id)) + 1
    : 1;

  notes.push({
    id: nextId,
    text: trimmedText,
    category: category
  });

  console.log("Note added successfully.");
  return true;
}
console.log("searchNotes('day'):", searchNotes("day")); console.log("longestNote():", longestNote()); console.log("countByCategory():", countByCategory()); console.log("getSummary():", getSummary()); console.log( "isDuplicate(' BUY MILK AND BREAD '):", isDuplicate(" BUY MILK AND BREAD ") ); console.log( "addNote('', 'personal'):", addNote("", "personal") ); console.log( "addNote('Buy milk and bread', 'personal'):", addNote("Buy milk and bread", "personal") ); console.log( "addNote('New note', 'invalid'):", addNote("New note", "invalid") ); console.log( "addNote('Plan weekend trip', 'personal'):", addNote("Plan weekend trip", "personal") );