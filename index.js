import { Client } from '@notionhq/client';
import _ from 'lodash';
import axios from 'axios'
import dotenv from 'dotenv';
import QuickChart from 'quickchart-js'

const CATEGORIES = ['Category 1', 'Category 2', 'Category 3', 'Category 4']

dotenv.config();

const clientId = process.env.IMGUR_CLIENT_ID;

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const { results: databaseObjs } = await notion.search({
  filter: {
    value: 'database',
    property: 'object',
  },
});

async function queryDatabase(db) {
  const queryResult = await notion.databases.query({
    database_id: db.id,
    "sorts": [
      {
        "property": "Category",
        "direction": "ascending"
      }
    ]
  })
  return { result: queryResult, dbInfo: db }
}


const databasesPromises = databaseObjs.map(queryDatabase)

const databases = await Promise.all(databasesPromises)

const data = databases.map((dbWithResults, idx) => {

  const queryResults = dbWithResults.result.results

  let catResults = {}
  let catResultsInPercent = {}
  let RComparison = []
  let winRate = 0

  queryResults.forEach(({ properties }) => {
    if (properties.Category.select) {

      if (catResults.hasOwnProperty(properties.Category.select.name)) {
        catResults[properties.Category.select.name] += 1
      } else {
        catResults[properties.Category.select.name] = 1
      }
    }

    if (properties['Potential Rs'].number !== null && properties['Total Rs'].number !== null) {
      RComparison.push({ potential: properties['Potential Rs'].number, total: properties['Total Rs'].number })
    }

    if (properties.Status.select.name === "Win" || properties.Status.select.name === "B/E") winRate += 1;

  })

  Object.keys(catResults).forEach((cat) => {
    catResultsInPercent[cat] = (
      (catResults[cat] / (Object.values(catResults)
        .reduce(
          function (pv, cv) { return pv + cv; }, 0)
      )) * 100).toFixed(2)
  })

  if (RComparison.length < 1 && _.isEmpty(catResults)) {
    return null
  }

  return { dbTitle: dbWithResults.dbInfo.title.at(0).plain_text, rs: RComparison, pureCats: catResults, cats: catResultsInPercent, winRate: `${((winRate / queryResults.length) * 100)}%` }
})

function generatePieChart(data) {
  const myChart = new QuickChart()
  myChart.setConfig({
    type: 'pie',
    data: { labels: Object.keys(data), datasets: [{ data: Object.values(data) }] },
    options: {
      title: {
        display: true,
        text: '% Category of trades taken'
      }
    }
  })
    .setWidth(800)
    .setHeight(800)
    .setBackgroundColor('transparent');

  return myChart.getUrl();
}

function generateBarChart(data, title) {
  const myChart = new QuickChart()
  myChart.setConfig({
    type: 'bar',
    data,
    options: {
      plugins: {
        datalabels: {
          anchor: 'center',
          align: 'center',
          color: '#000',
          font: {
            weight: 'bold',
          },
        },
      },
      title: {
        display: true,
        text: title
      }
    },
  })
    .setWidth(800)
    .setHeight(800)
    .setBackgroundColor('transparent');

  return myChart.getUrl();
}

function assignBy(key) {
  return (data, item) => {
    data[item[key]] = item;
    return data;
  }
}

async function swapLinks(chartlink) {

  const imgurLink = await axios
    .post('https://api.imgur.com/3/image', chartlink, {
      headers: {
        Accept: "application/json",
        Authorization: `Client-ID ${clientId}`,
      },
    })
    .then(({ data }) => {
      return data.data.link;
    });

  // console.log(imgurLink);
  return imgurLink;
}

const cleanSets = data.filter((x) => x !== null)

const ObjToAnalyze = cleanSets.reduce(assignBy('dbTitle'), {})

function dataForBarChartResultsComparison(bigObj) {
  const bigLabels = Object.keys(bigObj).sort()
  const datasets = [{ label: '', data: [] }, { label: '', data: [] }, { label: '', data: [] }, { label: '', data: [] }]

  CATEGORIES.forEach((cat, idx) => {
    datasets[idx].label = cat
    bigLabels.forEach((setResLabel, idy) => {
      datasets[idx].data.push(bigObj[setResLabel].pureCats[cat])
    })
  })

  return { labels: bigLabels, datasets }
}

function dataTradesPerSetBarChart(bigObj) {
  const bigLabels = Object.keys(bigObj).sort()
  const datasets = []

  bigLabels.forEach((tradeSet, idx) => {
    datasets.push(bigObj[tradeSet].rs.length)
  })

  return {
    labels: bigLabels, datasets: [{
      label: 'Trades per dataset', data: datasets
    }]
  }
}

console.log(
  generateBarChart(
    dataTradesPerSetBarChart(ObjToAnalyze),
    'Trades per dataset'
  )
)

// console.log(
//   await swapLinks(
//     generateBarChart(dataForBarChartResultsComparison(ObjToAnalyze), 'Comparison Trade Category per Set')
//   )
// )

// console.log(
//   await swapLinks(
//     generatePieChart(ObjToAnalyze['1'].cats)
//   )
// )

