/**
 * Utility functions for managing anonymous users
 */

import { adjectives, nouns, getRandomWord, capitalize } from './words';

const ANONYMOUS_USER_ID_KEY = 'anonymous_user_id';
const ANONYMOUS_USER_NAME_KEY = 'anonymous_user_name';

/**
 * Gets the current anonymous user ID from localStorage or creates a new one if it doesn't exist
 */
export const getAnonymousUserId = (): string => {
  // Check if user already has an ID
  let userId = localStorage.getItem(ANONYMOUS_USER_ID_KEY);
  
  // If not, generate one and store it
  if (!userId) {
    // Generate a random 8-digit number for the user ID
    userId = `${Math.floor(10000000 + Math.random() * 90000000)}`;
    localStorage.setItem(ANONYMOUS_USER_ID_KEY, userId);
  }
  
  return userId;
};

/**
 * Generates a memorable username by combining random adjective, noun, and a short number
 */
const generateMemorableUsername = (): string => {
  // Get random words
  const adjective = capitalize(getRandomWord(adjectives));
  const noun = capitalize(getRandomWord(nouns));
  
  // Generate a random 2-3 digit number
  const randomNum = Math.floor(10 + Math.random() * 990);
  
  // Combine everything
  return `${adjective}${noun}${randomNum}`;
};

/**
 * Gets the current anonymous user name based on their ID
 */
export const getAnonymousUserName = (): string => {
  // Check if user already has a name
  let userName = localStorage.getItem(ANONYMOUS_USER_NAME_KEY);
  
  // If not, generate a memorable username
  if (!userName) {
    userName = generateMemorableUsername();
    localStorage.setItem(ANONYMOUS_USER_NAME_KEY, userName);
  }
  
  return userName;
}; 