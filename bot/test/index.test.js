const fs = require("fs");
const path = require("path");
const nock = require("nock");
// Requiring our app implementation
const { Probot, ProbotOctokit } = require("probot");
const myProbotApp = require("..");
// Requiring our fixtures
const installationCreatedPayload = require("./fixtures/installation.created");

// Mocking out our use of random numbers
const mockMath = Object.create(global.Math);
mockMath.random = () => 1;
global.Math = mockMath;

const privateKey = fs.readFileSync(
  path.join(__dirname, "fixtures/mock-cert.pem"),
  "utf-8",
);

describe("My Probot app", () => {
  let probot;

  beforeEach(() => {
    nock.disableNetConnect();
    probot = new Probot({
      appId: 123,
      // disable request throttling and retries for testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
      privateKey,
    });
    // Load our app into probot
    probot.load(myProbotApp);
  });

  test("creates a pull request on installation", async () => {
    const mock = nock("https://api.github.com")
      .post("/app/installations/2/access_tokens")
      .reply(200, {
        permissions: {
          contents: "write",
          pull_requests: "write",
        },
        token: "test",
      })

      .get("/repos/hiimbex/testing-things/git/ref/heads%2Fmaster")
      .reply(200, { object: { sha: "abc123" } })

      .post("/repos/hiimbex/testing-things/git/refs", {
        ref: "refs/heads/new-branch-9999",
        sha: "abc123",
      })
      .reply(200)

      .put(
        "/repos/hiimbex/testing-things/contents/path%2Fto%2Fyour%2Ffile.md",
        {
          branch: "new-branch-9999",
          content: "TXkgbmV3IGZpbGUgaXMgYXdlc29tZSE=",
          message: "adds config file",
        },
      )
      .reply(200)

      .post("/repos/hiimbex/testing-things/pulls", {
        title: "Adding my file!",
        base: "master",
        body: "Adds my new file!",
        head: "new-branch-9999",
        maintainer_can_modify: true,
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: "installation",
      payload: installationCreatedPayload,
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
});

// For more information about testing with Jest see:
// https://facebook.github.io/jest/

// For more information about testing with Nock see:
// https://github.com/nock/nock
