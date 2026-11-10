// =====================================================
// DSA PROBLEMS
// Solved in order: problem N unlocks when problem N-1 is accepted, and solving
// problem N plays strip N from STRIP_SEQUENCE in config.js (keep both lists the
// same length).
//
// Each problem has 2 visible tests (shown in full) and 8 hidden tests (only
// pass/fail is shown). Tests are written as Python expressions:
//   args:     a Python list of the arguments, e.g. '[[2, 7, 11, 15], 9]'
//   expected: the expected return value,       e.g. '[0, 1]'
// They are evaluated inside the Python runtime, so large inputs can be
// generated with an expression instead of being written out.
//
// compare: 'exact'     -> result must equal expected (tuples count as lists)
//          'unordered' -> lists are compared ignoring order
// =====================================================

export const PROBLEMS = [
  // ---------------------------------------------------
  // 1. Two Sum
  // ---------------------------------------------------
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    fn: 'two_sum',
    compare: 'unordered',
    statement: `
      <p>Given a list of integers <code>nums</code> and an integer <code>target</code>,
      return the <strong>indices</strong> of the two numbers that add up to <code>target</code>.</p>
      <p>Each input has <strong>exactly one solution</strong>, and you may not use the same
      element twice. You can return the answer in any order.</p>`,
    examples: [
      { input: 'nums = [2, 7, 11, 15], target = 9', output: '[0, 1]', note: 'nums[0] + nums[1] == 2 + 7 == 9' },
      { input: 'nums = [3, 2, 4], target = 6', output: '[1, 2]' },
    ],
    constraints: [
      '<code>2 ≤ len(nums) ≤ 2 × 10⁴</code>',
      '<code>-10⁹ ≤ nums[i], target ≤ 10⁹</code>',
      'Exactly one valid answer exists.',
    ],
    hint: 'Can you do it in a single pass, faster than checking every pair?',
    starter: `def two_sum(nums, target):
    # Return the indices [i, j] of the two numbers that add up to target
    pass
`,
    visibleTests: [
      { label: 'nums = [2, 7, 11, 15], target = 9', args: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' },
      { label: 'nums = [3, 2, 4], target = 6', args: '[[3, 2, 4], 6]', expected: '[1, 2]' },
    ],
    hiddenTests: [
      { args: '[[3, 3], 6]', expected: '[0, 1]' },
      { args: '[[-1, -2, -3, -4, -5], -8]', expected: '[2, 4]' },
      { args: '[[0, 4, 3, 0], 0]', expected: '[0, 3]' },
      { args: '[[1, 5, 9, 14, 20], 34]', expected: '[3, 4]' },
      { args: '[[-3, 4, 3, 90], 0]', expected: '[0, 2]' },
      { args: '[[5, 75, 25], 100]', expected: '[1, 2]' },
      // 20 000 numbers, the answer is the last two: checking every pair is far too slow
      { args: '[list(range(1, 20001)), 39999]', expected: '[19998, 19999]' },
      { args: '[[500000000 + i for i in range(19998)] + [3, 7], 10]', expected: '[19998, 19999]' },
    ],
  },

  // ---------------------------------------------------
  // 2. Valid Parentheses
  // ---------------------------------------------------
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    fn: 'is_valid',
    compare: 'exact',
    statement: `
      <p>Given a string <code>s</code> containing only the characters
      <code>(</code> <code>)</code> <code>{</code> <code>}</code> <code>[</code> <code>]</code>,
      return <code>True</code> if the string is valid, otherwise <code>False</code>.</p>
      <p>A string is valid when every open bracket is closed by the same type of bracket,
      and brackets are closed in the correct order.</p>`,
    examples: [
      { input: 's = "()[]{}"', output: 'True' },
      { input: 's = "(]"', output: 'False' },
    ],
    constraints: [
      '<code>1 ≤ len(s) ≤ 10⁵</code>',
      '<code>s</code> consists only of the six bracket characters above.',
    ],
    hint: 'The most recently opened bracket must be the first one closed.',
    starter: `def is_valid(s):
    # Return True if the brackets in s are balanced and correctly nested
    pass
`,
    visibleTests: [
      { label: 's = "()[]{}"', args: '["()[]{}"]', expected: 'True' },
      { label: 's = "(]"', args: '["(]"]', expected: 'False' },
    ],
    hiddenTests: [
      { args: '["("]', expected: 'False' },
      { args: '["([)]"]', expected: 'False' },
      { args: '["{[]}"]', expected: 'True' },
      { args: '["}{"]', expected: 'False' },
      { args: '["{[()()]}[]({})"]', expected: 'True' },
      { args: '["(()"]', expected: 'False' },
      { args: '["(" * 50000 + ")" * 50000]', expected: 'True' },
      { args: '["[" + "()" * 30000]', expected: 'False' },
    ],
  },

  // ---------------------------------------------------
  // 3. Longest Substring Without Repeating Characters
  // ---------------------------------------------------
  {
    id: 'longest-substring',
    title: 'Longest Substring Without Repeats',
    difficulty: 'Medium',
    fn: 'length_of_longest_substring',
    compare: 'exact',
    statement: `
      <p>Given a string <code>s</code>, return the length of the
      <strong>longest substring</strong> that contains no repeated characters.</p>
      <p>A substring is a contiguous run of characters inside the string.</p>`,
    examples: [
      { input: 's = "abcabcbb"', output: '3', note: 'The longest is "abc".' },
      { input: 's = "bbbbb"', output: '1', note: 'The longest is "b".' },
    ],
    constraints: [
      '<code>0 ≤ len(s) ≤ 10⁵</code>',
      '<code>s</code> can contain any Unicode characters, including spaces.',
    ],
    hint: 'Keep a window that only ever grows to the right, and move its left edge when a repeat appears.',
    starter: `def length_of_longest_substring(s):
    # Return the length of the longest substring with no repeated characters
    pass
`,
    visibleTests: [
      { label: 's = "abcabcbb"', args: '["abcabcbb"]', expected: '3' },
      { label: 's = "bbbbb"', args: '["bbbbb"]', expected: '1' },
    ],
    hiddenTests: [
      { args: '["pwwkew"]', expected: '3' },
      { args: '[""]', expected: '0' },
      { args: '[" "]', expected: '1' },
      { args: '["dvdf"]', expected: '3' },
      { args: '["abba"]', expected: '2' },
      { args: '["tmmzuxt"]', expected: '5' },
      // 100 000 characters: checking every substring is far too slow
      { args: '["".join(chr(97 + i % 26) for i in range(100000))]', expected: '26' },
      { args: '["".join(chr(0x4E00 + i) for i in range(20000))]', expected: '20000' },
    ],
  },

  // ---------------------------------------------------
  // 4. Coin Change
  // ---------------------------------------------------
  {
    id: 'coin-change',
    title: 'Coin Change',
    difficulty: 'Medium',
    fn: 'coin_change',
    compare: 'exact',
    statement: `
      <p>You are given a list of coin denominations <code>coins</code> and an integer
      <code>amount</code>. Return the <strong>fewest number of coins</strong> needed to make up
      that amount, or <code>-1</code> if it cannot be made.</p>
      <p>You have an unlimited supply of each coin.</p>`,
    examples: [
      { input: 'coins = [1, 2, 5], amount = 11', output: '3', note: '11 = 5 + 5 + 1' },
      { input: 'coins = [2], amount = 3', output: '-1' },
    ],
    constraints: [
      '<code>1 ≤ len(coins) ≤ 12</code>',
      '<code>1 ≤ coins[i] ≤ 2³¹ − 1</code>',
      '<code>0 ≤ amount ≤ 10⁴</code>',
    ],
    hint: 'Always grabbing the biggest coin is not always optimal. Build the answer up from smaller amounts. A bottom-up loop also sidesteps deep recursion, which Python running in the browser handles poorly (about 200 levels with @lru_cache).',
    starter: `def coin_change(coins, amount):
    # Return the fewest coins that sum to amount, or -1 if impossible
    pass
`,
    visibleTests: [
      { label: 'coins = [1, 2, 5], amount = 11', args: '[[1, 2, 5], 11]', expected: '3' },
      { label: 'coins = [2], amount = 3', args: '[[2], 3]', expected: '-1' },
    ],
    hiddenTests: [
      { args: '[[1], 0]', expected: '0' },
      { args: '[[1, 2, 5], 100]', expected: '20' },
      { args: '[[1, 3, 4], 6]', expected: '2' },
      { args: '[[2, 5, 10, 1], 27]', expected: '4' },
      { args: '[[186, 419, 83, 408], 6249]', expected: '20' },
      // Big amounts, where trying every combination is far too slow. The smallest
      // coin is always at least amount / 120, so a top-down recursive solution
      // never needs more than ~120 levels (browser Python handles ~200 with
      // @lru_cache and much more with plain functions).
      { args: '[[89, 97, 103, 113], 9999]', expected: '89' },
      { args: '[[1, 5, 10, 25], 99]', expected: '9' },
      { args: '[[100, 200, 300], 9999]', expected: '-1' },
    ],
  },
];
