module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run serve:lhci",
      startServerReadyPattern: "Ready in|Ready",
      url: ["http://localhost:3000/"],
      settings: {
        chromeFlags: "--no-sandbox --disable-dev-shm-usage --disable-gpu",
        maxWaitForLoad: 45000,
      },
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.8 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
