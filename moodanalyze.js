const Sentiment = require('sentiment');
const sentiment = new Sentiment();

function getMoodFromText(text) {
  if (!text || text.trim() === '') {
    return 'Unknown';
  }

  const result = sentiment.analyze(text);
  const score = result.comparative;

  // Define thresholds to categorize the score
  if (score > 0.5) {
    return 'Joyful'; // Very positive
  }
  if (score > 0.1) {
    return 'Mild Happiness'; // Moderately positive
  }
  if (score >= -0.1) {
    return 'Neutral'; // Close to zero
  }
  if (score >= -0.5) {
    return 'Anxious'; // Moderately negative
  }
  return 'Upset'; // Very negative
}

// theme-analyzer.js

const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

// Define your themes and their associated keywords
const THEME_KEYWORDS = {
  work: ['project', 'meeting', 'deadline', 'report', 'client', 'colleague', 'office', 'job'],
  personal_growth: ['learning', 'book', 'skill', 'goal', 'habit', 'meditation', 'reflecting'],
  health: ['gym', 'workout', 'run', 'sleep', 'tired', 'anxious', 'food', 'healthy'],
  relationships: ['friends', 'family', 'partner', 'date', 'talked', 'together'],
  hobbies: ['music', 'movie', 'game', 'painting', 'cooking', 'instrument'],
};

function getThemesFromText(text) {
  if (!text || text.trim() === '') {
    return ['unknown'];
  }

  // Tokenize the text and convert to lowercase for easy matching
  const tokens = tokenizer.tokenize(text.toLowerCase());
  const foundThemes = new Set(); // Use a Set to avoid duplicate themes

  // Loop through each theme and its keywords
  for (const theme in THEME_KEYWORDS) {
    for (const keyword of THEME_KEYWORDS[theme]) {
      if (tokens.includes(keyword)) {
        foundThemes.add(theme);
        break; // Move to the next theme once one keyword is found
      }
    }
  }

  if (foundThemes.size === 0) {
    return ['general']; // A default theme if no keywords match
  }

  return Array.from(foundThemes);
}

function analyzeJournalEntry(journalText) {
  const mood = getMoodFromText(journalText);
  const themes = getThemesFromText(journalText);
  
  return {
    mood,
    themes,
  };
}

module.exports  = {analyzeJournalEntry};