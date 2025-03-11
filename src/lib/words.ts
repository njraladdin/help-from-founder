/**
 * Word lists for generating memorable usernames
 */

// Adjectives that are friendly and appropriate
export const adjectives = [
  "happy", "sunny", "clever", "bright", "swift", "brave", "calm", "cool",
  "fair", "kind", "wise", "nice", "neat", "proud", "super", "gentle",
  "eager", "epic", "zesty", "merry", "noble", "vivid", "bold", "cozy",
  "smart", "keen", "grand", "agile", "quick", "jolly", "lucky", "honest",
  "witty", "fresh", "loyal", "fancy", "jazzy", "mighty", "young", "active",
  "fluffy", "cuddly", "sparkly", "graceful", "cheerful", "dazzling", "glowing", "radiant",
  "friendly", "peaceful", "charming", "brilliant", "colorful", "delightful", "energetic", "playful",
  "majestic", "magical", "joyful", "lively", "talented", "creative", "amazing", "wonderful",
  "shining", "gleaming", "vibrant", "spirited", "adventurous", "dynamic", "passionate", "fearless",
  "focused", "handsome", "beautiful", "daring", "confident", "comical", "curious", "determined",
  "electric", "excited", "fabulous", "fantastic", "fiery", "gallant", "gifted", "glorious",
  "grateful", "heroic", "humble", "innocent", "inspired", "legendary", "marvelous", "optimistic",
  "peaceful", "perky", "pleasant", "polished", "powerful", "precious", "remarkable", "resourceful",
  "respected", "sincere", "skillful", "stellar", "stunning", "terrific", "thoughtful", "thriving",
  "tranquil", "triumphant", "upbeat", "valiant", "versatile", "victorious", "vigilant", "virtuous",
  "warm", "worthy", "zealous", "electric", "cosmic", "crystal", "diamond", "emerald",
  "golden", "silver", "platinum", "ruby", "sapphire", "amber", "bronze", "copper",
  "jade", "marble", "opal", "pearl", "quartz", "coral", "ivory", "azure"
];

// Animals and other fun nouns
export const nouns = [
  "panda", "tiger", "eagle", "otter", "koala", "fox", "dolphin", "turtle",
  "rabbit", "wolf", "whale", "falcon", "parrot", "lion", "dragon", "phoenix",
  "zebra", "giraffe", "penguin", "buffalo", "raccoon", "squirrel", "lynx", "raven",
  "badger", "puma", "gazelle", "bear", "lemur", "seal", "shark", "leopard",
  "robin", "falcon", "hawk", "owl", "sparrow", "meerkat", "cobra", "jaguar",
  "toucan", "panther", "cheetah", "elephant", "gorilla", "hippo", "rhino", "monkey",
  "hedgehog", "hamster", "ferret", "weasel", "mouse", "duck", "goose", "swan",
  "crane", "heron", "flamingo", "peacock", "parrot", "stork", "pelican", "seagull",
  "dinosaur", "mammoth", "unicorn", "griffin", "pegasus", "mermaid", "centaur", "minotaur",
  "kraken", "hydra", "chimera", "cyclops", "sphinx", "yeti", "bigfoot", "dragon",
  "alligator", "crocodile", "chameleon", "iguana", "tortoise", "python", "viper", "basilisk",
  "scorpion", "beetle", "butterfly", "firefly", "ladybug", "mantis", "dragonfly", "caterpillar",
  "warrior", "wizard", "ninja", "samurai", "knight", "ranger", "pirate", "captain",
  "sailor", "pilot", "astronaut", "explorer", "pioneer", "hunter", "archer", "wanderer",
  "voyager", "nomad", "viking", "titan", "giant", "hero", "champion", "guardian",
  "sentinel", "watcher", "defender", "protector", "paladin", "templar", "crusader", "valkyrie",
  "mountain", "valley", "canyon", "river", "ocean", "island", "desert", "forest",
  "jungle", "tundra", "meadow", "prairie", "volcano", "glacier", "waterfall", "lagoon",
  "nebula", "galaxy", "comet", "meteor", "planet", "star", "asteroid", "supernova",
  "horizon", "eclipse", "rainbow", "aurora", "thunder", "lightning", "hurricane", "tornado"
];

// Function to get a random word from an array
export const getRandomWord = (wordArray: string[]): string => {
  return wordArray[Math.floor(Math.random() * wordArray.length)];
};

// Function to capitalize the first letter of a word
export const capitalize = (word: string): string => {
  return word.charAt(0).toUpperCase() + word.slice(1);
}; 