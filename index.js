import dotenv from 'dotenv';
import { Client } from '@notionhq/client';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const { results: databases } = await notion.search({
  filter: {
    value: 'database',
    property: 'object',
  },
});

const databaseIds = databases.map((database) => database.id)

console.log(databaseIds)
