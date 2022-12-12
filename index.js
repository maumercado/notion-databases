import dotenv from 'dotenv';
import { Client } from '@notionhq/client';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const { results: databaseObjs } = await notion.search({
  filter: {
    value: 'database',
    property: 'object',
  },
});

const databasesPromises = databaseObjs.map(async ({ id }) => {
  return notion.databases.query({
    database_id: id,
    "sorts": [
      {
        "property": "Category",
        "direction": "ascending"
      }
    ]

  })
})

const databases = await Promise.all(databasesPromises)

const data = databases.map(({ results }) => {
  let catResults = {}
  let RComparison = []

  results.forEach(({ properties }) => {
    if (properties.Category.select) {

      if (catResults.hasOwnProperty(properties.Category.select.name)) {
        catResults[properties.Category.select.name] += 1
      } else {
        catResults[properties.Category.select.name] = 1
      }
    }

    console.log(properties['Potential Rs'].number, properties['Total Rs'].number)

    if (properties['Potential Rs'].number !== null && properties['Total Rs'].number !== null) {
      RComparison.push({ potential: properties['Potential Rs'].number, total: properties['Total Rs'].number })
    }
  })


  return { rs: RComparison, cats: catResults }
})

console.log(data[1].rs)
