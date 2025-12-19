
export enum Category {
  ROAD_SIGNS = "道路标志 (Segnali)",
  RULES = "交通规则 (Norme)",
  VEHICLE = "车辆构造 (Motore)",
  BEHAVIOR = "驾驶行为 (Comportamento)",
  SAFETY = "安全防护 (Sicurezza)",
  ACCIDENTS = "事故处理 (Incidenti)",
  DOCUMENTS = "证件法规 (Documenti)",
  // Added GENERAL category used in constants.ts and App.tsx
  GENERAL = "通用词汇 (Generale)"
}

export interface Word {
  id: string;
  it: string;
  cn: string;
  category: Category;
  interval: number; // 复习间隔（天）
  easeFactor: number;
  nextReviewDate: number; // 下次复习的时间戳
  repetition: number; // 成功复习次数
}

export interface UserStats {
  learnedCount: number;
  totalCorrect: number;
  totalAttempts: number;
}

export interface QuizState {
  currentWord: Word | null;
  options: string[];
  selectedIndex: number | null;
  isCorrect: boolean | null;
}