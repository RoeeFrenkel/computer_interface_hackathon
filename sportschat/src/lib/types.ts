export type ExpertiseLevel = "beginner" | "casual" | "hardcore";

export interface AskRequest {
  question: string;
  timestamp: number;
  expertise: ExpertiseLevel;
}

export interface AskResponse {
  answer: string;
}
