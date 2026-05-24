import { buildProfileFromSbti } from "./buildProfileFromSbti.js";
import { renderPersonaResult } from "./renderPersonaResult.js";
import { scoreSbtiAnswers } from "./scoreSbtiAnswers.js";

export { adaptRecommendationWeights } from "./adaptRecommendationWeights.js";
export { buildProfileFromSbti } from "./buildProfileFromSbti.js";
export { renderPersonaResult } from "./renderPersonaResult.js";
export { renderPersonaResultHtml } from "./renderPersonaResultHtml.js";
export { scoreSbtiAnswers } from "./scoreSbtiAnswers.js";
export {
  DIMENSION_QUESTION_IDS,
  SAMPLE_SBTI_ANSWERS,
  SBTI_QUESTIONS,
  TAG_QUESTION_IDS,
  getQuestionById,
  getQuestionOption,
  getQuestionOptionValues,
  getSbtiQuestions,
  labelForAnswer
} from "./sbtiQuestions.js";
export { getRecommendationWeightTerms, getSbtiType, getSbtiTypes, resolveSbtiType } from "./sbtiTypes.js";

export function generateSbtiProfile({ answers, generatedBy } = {}) {
  const sbtiResult = scoreSbtiAnswers(answers);
  const profile = buildProfileFromSbti({ answers: sbtiResult.answers, sbtiResult, tags: sbtiResult.tags, generatedBy });
  const personaResult = renderPersonaResult({ sbtiResult, tags: sbtiResult.tags, profile });

  return {
    sbtiResult,
    tags: sbtiResult.tags,
    profile,
    personaResult
  };
}
