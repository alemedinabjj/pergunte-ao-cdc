module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['api', 'web', 'contracts', 'ingestion', 'retrieval', 'chat', 'llm', 'eval', 'infra', 'docs'],
    ],
  },
};
