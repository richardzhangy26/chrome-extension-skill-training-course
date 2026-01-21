/**
 * 智能体对话相关常量
 */

// API基础URL
export const API_BASE_URL = 'https://cloudapi.polymas.com';

// 教学平台域名
export const TEACHING_PLATFORM_DOMAIN = 'hike-teaching-center.polymas.com';

// API端点
export const API_ENDPOINTS = {
  /** 获取步骤列表 */
  QUERY_SCRIPT_STEP_LIST: '/teacher-course/abilityTrain/queryScriptStepList',
  /** 获取第一步骤流程 */
  QUERY_SCRIPT_STEP_FLOW_LIST: '/teacher-course/abilityTrain/queryScriptStepFlowList',
  /** 启动步骤 */
  RUN_CARD: '/ai-tools/trainRun/runCard',
  /** 发送对话 */
  CHAT: '/ai-tools/trainRun/chat',
} as const;

// Cookie相关
export const COOKIE_DOMAIN = '.polymas.com';
export const AUTH_COOKIE_NAME = 'Authorization';

// 存储键
export const STORAGE_KEYS = {
  AGENT_SESSION: 'agent-session',
  AGENT_CHAT_MESSAGES: 'agent-chat-messages',
} as const;

// 工作流状态转换映射
export const WORKFLOW_TRANSITIONS = {
  IDLE: ['FETCHING_STEPS', 'ERROR'],
  FETCHING_STEPS: ['FETCHING_FIRST_STEP', 'ERROR'],
  FETCHING_FIRST_STEP: ['RUNNING_CARD', 'ERROR'],
  RUNNING_CARD: ['CHATTING', 'ERROR'],
  CHATTING: ['CHATTING', 'COMPLETED', 'ERROR'],
  COMPLETED: ['IDLE'],
  ERROR: ['IDLE'],
} as const;

// UI相关常量
export const UI_CONSTANTS = {
  MAX_MESSAGE_LENGTH: 5000,
  TYPING_DELAY_MS: 50,
  AUTO_SCROLL_THRESHOLD: 100,
} as const;
