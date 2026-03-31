import { createMcpServer } from "@/lib/mcp-tools";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest, NextResponse } from "next/server";

function checkAuth(req: NextRequest): boolean {
  const key = process.env.MCP_API_KEY;
  if (!key) return false;

  // Accept token via query param ?key=xxx or Authorization header
  const queryKey = req.nextUrl.searchParams.get("key");
  if (queryKey === key) return true;

  const auth = req.headers.get("authorization");
  if (!auth) return false;
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return token === key;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide Authorization: Bearer <MCP_API_KEY>" },
      { status: 401 },
    );
  }

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  await server.connect(transport);

  // handleRequest expects a web-standard Request and returns a web-standard Response
  return await transport.handleRequest(req);
}

export async function GET() {
  return NextResponse.json(
    {
      name: "CinqCentral MCP",
      version: "1.0.0",
      info: "POST JSON-RPC messages to this endpoint with Authorization: Bearer <MCP_API_KEY>",
    },
    { status: 200 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Sessions not supported in stateless mode" },
    { status: 405 },
  );
}
