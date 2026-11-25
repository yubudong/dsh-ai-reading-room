# AI 书房 / AI Reading Room 0.5.3

这是分发方式更新，业务功能沿用 0.5.2：仅右键标注、按书籍隔离的撤销/重做、书虫、读书方法论、阅读回顾与学习记录筛选保持不变。

## npm 安装

包名：`dsh-ai-reading-room`

```sh
npm install dsh-ai-reading-room@0.5.3
```

在 DSH 中安装并启用，使用插件管理器添加包名，或运行：

```sh
dsh plugin --profile <profile> add dsh-ai-reading-room@0.5.3
```

普通 npm install 只负责下载 Node 包，不会自动把插件启用到 DSH 配置。

## 本版变化

- 增加官方 npm registry 的公开发布配置与双语安装说明。
- 随包提供预构建 Host、Client、PDF 资源和说明书，不需要安装时执行构建脚本。
- 保留 0.5.2 Host 导出别名，兼容此前已配置的入口。
- GitHub 0.5.2 安装包与校验和不变，0.5.3 使用独立标签和附件。
- 兼容基线保持 DSH Desktop 0.2.2-rc.2、Node.js 22.13.0+。原书、学习记录和凭据不随软件包发布。

市场收录仍取决于仓库年龄检查及维护者审核，npm 发布不代表市场已经上架。完整业务功能见上一版发行说明与使用说明书；真实页面的全面目视验收限制保持不变。

---

This is a distribution-only update. It adds public npm publishing configuration and installation instructions while retaining 0.5.2 application behavior. Prebuilt artifacts and a backward-compatible Host entry are included; no install-time build is required. The existing 0.5.2 GitHub assets remain unchanged. A plain `npm install` downloads the package; use DSH's plugin manager or the DSH command above to activate it. User books, learning records and credentials are excluded. Market acceptance remains a separate process.
