// app/api/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { checkMessageLimit, incrementMessageCount } from '@/lib/db/utils';

export async function POST(req: NextRequest) {
  try {
    const { story } = await req.json();

    if (!story) {
      return NextResponse.json(
        { error: 'Missing story parameter' },
        { status: 400 }
      );
    }

    // Get the authenticated user.
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get the team details for the user.
    const team = await getTeamForUser(user.id);
    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Check the team’s monthly message limit.
    const { withinLimit, remainingMessages } = await checkMessageLimit(team.id);
    if (!withinLimit) {
      return NextResponse.json(
        {
          error:
            'Monthly message limit reached. Upgrade your plan for unlimited messages.',
        },
        { status: 403 }
      );
    }

    // Increment the team's message count.
    await incrementMessageCount(team.id, 1);

    // Validate required environment variables.
    if (!process.env.WORKFLOW_ID || !process.env.AITUTOR_API_KEY) {
      return NextResponse.json(
        { error: 'Missing environment variables: WORKFLOW_ID or AITUTOR_API_KEY' },
        { status: 500 }
      );
    }

    // Call the external AI Tutor API's run endpoint.
    const response = await fetch(
      `https://aitutor-api.vercel.app/api/v1/run/${process.env.WORKFLOW_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AITUTOR_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ story }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Error generating story' },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
