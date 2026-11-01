export const openapi = {
  openapi: '3.1.0',
  info: {
    title: '名箓 Minglu API',
    version: '0.6.0',
    description: '本地古典中文取名器：姓 + 名（+ 可选字辈），以及法宝名。',
  },
  servers: [{ url: 'http://127.0.0.1:5178', description: '本地默认地址' }],
  paths: {
    '/health': {
      get: {
        summary: '健康检查',
        responses: { '200': { description: '服务正常' } },
      },
    },
    '/v1/profiles': {
      get: {
        summary: '列出时代/性别/风格/阶层',
        responses: { '200': { description: '枚举值' } },
      },
    },
    '/v1/generations': {
      get: {
        summary: '列出字辈模板',
        responses: { '200': { description: '模板数组' } },
      },
    },
    '/v1/packs': {
      get: {
        summary: '列出已加载数据包',
        responses: { '200': { description: '包元数据' } },
      },
    },
    '/v1/pack': {
      get: {
        summary: '返回当前 pack 的完整 JSON（浏览器 SDK 用）',
        responses: { '200': { description: 'pack 对象' } },
      },
    },
    '/v1/technique-parts': {
      get: {
        summary: '列出功法起手/中段/后缀',
        responses: { '200': { description: '功法词表' } },
      },
    },
    '/v1/techniques': {
      post: {
        summary: '生成功法名（三槽，B 槽可为空）',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  count: { type: 'integer', minimum: 1, maximum: 10000 },
                  seed: { oneOf: [{ type: 'number' }, { type: 'string' }] },
                  kind: { type: 'string', enum: ['意象', '动作', '程度', 'any'] },
                  suffix: {
                    type: 'string',
                    enum: ['诀', '功', '真经', '妙法', '篇', '典', '剑章', '真本', '直指', '灵书', '要义', '神册', '录', 'any'],
                  },
                },
              },
            },
          },
        },
        responses: { '200': { description: '功法名数组' } },
      },
    },
    '/v1/pill-parts': {
      get: {
        summary: '列出丹药修饰词/核心/后缀',
        responses: { '200': { description: '丹药词表' } },
      },
    },
    '/v1/pills': {
      post: {
        summary: '生成丹药名',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  count: { type: 'integer', minimum: 1, maximum: 10000 },
                  seed: { oneOf: [{ type: 'number' }, { type: 'string' }] },
                  kind: { type: 'string', enum: ['突破', '疗伤', '淬体', '神魂', '通用', '毒', 'any'] },
                  suffix: { type: 'string', enum: ['丹', '膏', '散', '露', 'any'] },
                  mode: { type: 'string', enum: ['function', 'high', 'poison', 'any'] },
                },
              },
            },
          },
        },
        responses: { '200': { description: '丹药名数组' } },
      },
    },
    '/v1/sect-parts': {
      get: {
        summary: '列出宗门前缀与后缀',
        responses: { '200': { description: '宗门词表' } },
      },
    },
    '/v1/sects': {
      post: {
        summary: '生成宗门名',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  count: { type: 'integer', minimum: 1, maximum: 10000 },
                  seed: { oneOf: [{ type: 'number' }, { type: 'string' }] },
                  alignment: { type: 'string', enum: ['正道', '魔道', '中立', 'any'] },
                },
              },
            },
          },
        },
        responses: { '200': { description: '宗门名数组' } },
      },
    },
    '/v1/artifact-parts': {
      get: {
        summary: '列出法宝修饰词与器型',
        responses: { '200': { description: '法宝词表' } },
      },
    },
    '/v1/artifacts': {
      post: {
        summary: '生成法宝名',
        requestBody: {
          required: false,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ArtifactRequest' } } },
        },
        responses: { '200': { description: '法宝名数组' } },
      },
    },
    '/v1/names': {
      post: {
        summary: '生成 1–1000 个人名',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NameRequest' } } },
        },
        responses: { '200': { description: '人名数组' } },
      },
    },
    '/v1/names/check': {
      post: {
        summary: '查重名/谐音/生僻字',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string', description: '待查姓名' } },
              },
            },
          },
        },
        responses: { '200': { description: '检查报告' } },
      },
    },
    '/v1/batch': {
      post: {
        summary: '大批量生成，流式 JSONL（最多 100000 条）',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NameRequest' } } },
        },
        responses: {
          '200': {
            description: 'application/x-ndjson，每行一个 PersonName',
            content: { 'application/x-ndjson': { schema: { type: 'string' } } },
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        summary: 'OpenAPI 3.1 文档',
        responses: { '200': { description: '本文件' } },
      },
    },
  },
  components: {
    schemas: {
      Profile: {
        type: 'object',
        description: '生成档案；所有字段可选',
        properties: {
          era: { type: 'string', enum: ['qinhan', 'weijin', 'tangsong', 'mingqing', 'xianxia'] },
          gender: { type: 'string', enum: ['male', 'female', 'any'] },
          style: { type: 'array', items: { type: 'string', enum: ['史实', '写意', '宗教'] } },
          class: { type: 'string', enum: ['士族', '寒门', '僧道', '江湖', '宫闱', '仙门'] },
          surname: { type: 'string', description: '指定姓氏；只接受 1–4 个汉字' },
          givenLength: { oneOf: [{ type: 'string', enum: ['auto'] }, { type: 'integer', enum: [1, 2] }] },
          allusion: { type: 'string', enum: ['chuci', 'shijing', 'lunyu', 'all'], description: '只取对应经典的用典名' },
          generation: {
            oneOf: [
              { type: 'null' },
              {
                type: 'object',
                properties: {
                  preset: { type: 'string' },
                  poem: { type: 'string' },
                  index: { type: 'integer', minimum: 1 },
                  position: { type: 'string', enum: ['first', 'second'] },
                  applyTo: { type: 'string', enum: ['all', 'male', 'female'] },
                },
              },
            ],
          },
          restraint: { type: 'number', minimum: 0, maximum: 1 },
          seed: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
          count: { type: 'integer', minimum: 0, maximum: 100000 },
          mode: { type: 'string', enum: ['stable', 'diverse'] },
        },
      },
      NameRequest: {
        type: 'object',
        properties: {
          profile: { $ref: '#/components/schemas/Profile' },
          count: { type: 'integer', minimum: 0, maximum: 100000 },
          seed: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
        },
      },
      ArtifactRequest: {
        type: 'object',
        properties: {
          count: { type: 'integer', minimum: 0, maximum: 10000 },
          seed: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
        },
      },
      PersonName: {
        type: 'object',
        description: '一个人名结果；v0.6 起不含 courtesy（字）',
        required: ['fullName', 'surname', 'given', 'styleTags', 'warnings', 'seed', 'license'],
        properties: {
          schemaVersion: { type: 'string' },
          fullName: { type: 'string' },
          surname: { type: 'object' },
          given: { type: 'array', items: { type: 'object' } },
          generation: { oneOf: [{ type: 'null' }, { type: 'object' }] },
          pattern: { type: 'string', description: '特例标记；当前为 religious-prefix' },
          allusion: { type: 'object', description: '楚辞典故匹配；含 source 与 line' },
          styleTags: { type: 'array', items: { type: 'string' } },
          era: { type: 'string' },
          gender: { type: 'string' },
          class: { type: 'string' },
          score: { type: 'number' },
          warnings: { type: 'array', items: { type: 'object' } },
          seed: { type: 'integer' },
          profileHash: { type: 'string' },
          pack: { type: 'object' },
          license: { type: 'string' },
          provenance: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;
