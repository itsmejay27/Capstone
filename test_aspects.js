// Test script to verify zero duplicates across 60 items
const topics = ['Database Indexing', 'Transaction Management & ACID', 'Relational Schema Normalization', 'Concurrency Control'];
const cogs = ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating', 'Remembering / Understanding', 'Applying / Analyzing'];

const aspects = [
  'foundational architecture and design patterns',
  'operational execution lifecycle',
  'fault-tolerance and recovery protocols',
  'resource optimization and latency constraints',
  'interface contract compliance and data flow',
  'concurrency control and state synchronization',
  'systemic trade-offs and edge-case behaviors',
  'telemetry, diagnostics, and anomaly detection',
  'data integrity and schema validation constraints',
  'security boundaries and access verification',
  'scalability barriers and throughput dynamics',
  'modular decoupling and maintenance paradigms'
];

const questionTemplates = [
  (top, asp) => `When evaluating ${asp} in ${top}, which principle is authoritative?`,
  (top, asp) => `In a production environment governed by ${top}, how does ${asp} directly influence operational integrity?`,
  (top, asp) => `Which implementation strategy ensures optimal reliability when configuring ${asp} within ${top}?`,
  (top, asp) => `What constitutes the primary technical objective when standardizing ${asp} for ${top}?`,
  (top, asp) => `Which structural risk arises when ${asp} is improperly managed or bypassed in ${top}?`,
  (top, asp) => `Under rigorous performance benchmarks, how does ${asp} dictate systemic behavior in ${top}?`,
  (top, asp) => `What diagnostic indicator most conclusively verifies that ${asp} is operating within normative boundaries in ${top}?`,
  (top, asp) => `In terms of long-term maintainability, why is rigorous adherence to ${asp} critical for ${top}?`
];

const stems = new Set();
let duplicates = 0;

for (let i = 0; i < 60; i++) {
  const top = topics[i % topics.length];
  const asp = aspects[i % aspects.length];
  const tpl = questionTemplates[(i + Math.floor(i / aspects.length)) % questionTemplates.length];
  const stem = tpl(top, asp);

  if (stems.has(stem)) {
    duplicates++;
    console.log(`Duplicate at #${i + 1}: ${stem}`);
  }
  stems.add(stem);
}

console.log(`Total items: 60 | Unique stems: ${stems.size} | Duplicates: ${duplicates}`);
if (duplicates === 0) {
  console.log('SUCCESS: All 60 items have completely distinct question stems!');
} else {
  console.log('FAILED');
}
