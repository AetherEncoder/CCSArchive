// A starter deck so a new user can try every mode right away.

import { importDeck } from './backup.js';

const SAMPLE = {
  deck: {
    title: 'Data Structures Basics',
    description: 'Core terms from an intro data structures course. Edit or delete it any time.',
    color: 'teal',
    tags: ['sample', 'ccs'],
  },
  cards: [
    { type: 'basic', front: 'Stack', back: 'A Last-In, First-Out (LIFO) collection. Items are pushed onto and popped from the top.' },
    { type: 'basic', front: 'Queue', back: 'A First-In, First-Out (FIFO) collection. Items are enqueued at the back and dequeued from the front.' },
    { type: 'basic', front: 'Linked list', back: 'A sequence of nodes where each node stores a value and a reference to the next node.' },
    { type: 'basic', front: 'Hash table', back: 'Maps keys to values using a hash function to compute an index into an array of buckets.' },
    { type: 'basic', front: 'Binary search tree', back: 'A binary tree where every left descendant is smaller and every right descendant is larger than the node.' },
    { type: 'basic', front: 'Big-O notation', back: "Describes how an algorithm's running time or space grows as the input size grows (the upper bound)." },
    { type: 'cloze', front: 'Binary search runs in {{O(log n)}} time on a sorted array.', back: 'It halves the search range on every step.' },
    { type: 'cloze', front: 'A {{heap}} is a complete binary tree used to implement a priority queue.', back: '' },
    {
      type: 'mcq',
      front: 'Which traversal visits a BST in sorted order?',
      back: 'In-order',
      choices: ['Pre-order', 'Post-order', 'Level-order'],
    },
    {
      type: 'mcq',
      front: 'What is the average time to look up a key in a hash table?',
      back: 'O(1)',
      choices: ['O(n)', 'O(log n)', 'O(n log n)'],
    },
  ],
};

export function createSampleDeck() {
  return importDeck(SAMPLE);
}
