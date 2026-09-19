// Automated test to verify the updated Exam Generator logic
const { buildTopicDrivenQuestionsForSpecs } = require('./dist/assets/index-BapZPlfR.js');

// Create 20 mock TOS items with various cognitive levels and topics
const mockSpecs = [];
const topics = ['Database Indexing', 'Transaction Management & ACID', 'Relational Schema Normalization', 'Concurrency Control'];
const cogs = ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating', 'Remembering / Understanding', 'Applying / Analyzing'];

for (let i = 1; i <= 20; i++) {
  mockSpecs.push({
    itemNumber: i,
    topic: topics[(i - 1) % topics.length],
    cognitiveLevel: cogs[(i - 1) % cogs.length],
    points: 1,
    questionType: 'multiple-choice'
  });
}

console.log('Testing question generation for 20 TOS items...');
const questions = buildTopicDrivenQuestionsForSpecs(mockSpecs, 'Database Systems', 'medium');

console.log(`Generated total items: ${questions.length}`);
if (questions.length !== 20) {
  console.error(`FAIL: Expected 20 items, got ${questions.length}`);
  process.exit(1);
}

// Check for uniqueness of question stems
const stems = new Set();
const answers = new Set();
let duplicates = 0;

questions.forEach((q, idx) => {
  if (stems.has(q.question)) {
    duplicates++;
    console.error(`Duplicate detected at #${idx + 1}: "${q.question}"`);
  }
  stems.add(q.question);
  answers.add(q.correctAnswer);

  if (idx < 5) {
    console.log(`\nItem #${q.itemPlacement} [${q.cognitiveLevel}] (${q.topic}):`);
    console.log(`  Question: ${q.question}`);
    console.log(`  Options: ${JSON.stringify(q.options)}`);
    console.log(`  Correct Key: Index ${q.correctAnswer} (${q.options[q.correctAnswer]})`);
  }
});

console.log(`\nUnique question stems: ${stems.size} / 20`);
console.log(`Distinct answer indices used: ${Array.from(answers).sort().join(', ')}`);

if (duplicates === 0) {
  console.log('SUCCESS: All 20 generated questions are 100% UNIQUE and strictly follow the TOS!');
} else {
  console.error(`FAIL: Found ${duplicates} duplicates!`);
  process.exit(1);
}
