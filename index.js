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
  }
});

const filteredDbs = databaseObjs.filter((db) =>
  /Set \d Results/.test(db.title.at(0).plain_text)
)

async function queryDatabase(db) {
  const queryResult = await notion.databases.query({
    database_id: db.id,
    sorts: [
      {
        property: "Entry Time",
        direction: "ascending"
      }
    ]
  })
  return { result: queryResult, dbInfo: db }
}

const databasesPromises = filteredDbs.map(queryDatabase)

const databases = await Promise.all(databasesPromises)

const data = databases.map((dbWithResults, idx) => {

  const queryResults = dbWithResults.result.results

  let catResults = {}
  let catResultsInPercent = {}
  let RComparison = []
  const bestTrades = []
  const worstTrades = []
  let winRate = 0

  queryResults.forEach(({ properties }) => {
    // in case of empty row
    if (!properties.Date.date) return;

    if (properties.Status.select.name === "Win" || properties.Status.select.name === "B/E") winRate += 1;

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


    if ((properties.Status.select.name === "Win" || properties.Status.select.name === "B/E") && properties.Score.number >= 7) {
      let bestTrade = {
        entryTime: properties['Entry Time'].date ? properties['Entry Time'].date.start : null,
        link: properties['Trade Page'].rich_text.at(0).href,
        name: properties['Trade Page'].rich_text.at(0).plain_text,
        strategy: properties['Strategy'].select ? properties['Strategy'].select.name : ''
      }
      bestTrades.push(bestTrade)
    }

    if (properties.Status.select.name === "Loss" && properties.Score.number <= 5) {
      let worstTrade = {
        entryTime: properties['Entry Time'].date ? properties['Entry Time'].date.start : null,
        link: properties['Trade Page'].rich_text.at(0).href,
        name: properties['Trade Page'].rich_text.at(0).plain_text,
        strategy: properties['Strategy'].select ? properties['Strategy'].select.name : ''
      }
      worstTrades.push(worstTrade)
    }
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

  return {
    bestTrades,
    dbTitle: dbWithResults.dbInfo.title.at(0).plain_text,
    cats: catResultsInPercent,
    pureCats: catResults,
    rs: RComparison,
    winRate: ((winRate / queryResults.length) * 100).toFixed(2),
    worstTrades
  }
})

function generatePieChart(data, setNo) {
  const myChart = new QuickChart()
  myChart.setConfig({
    type: 'pie',
    data,
    options: {
      title: {
        display: true,
        text: `% Category of trades taken on ${setNo}`
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

  return imgurLink;
}

const cleanSets = data.filter((x) => x !== null)

const ObjToAnalyze = cleanSets.reduce(assignBy('dbTitle'), {})


// function dataForBarChartResultsComparison(bigObj) {
//   const bigLabels = Object.keys(bigObj).sort()
//   const datasets = [{ label: '', data: [] }, { label: '', data: [] }, { label: '', data: [] }, { label: '', data: [] }]

//   CATEGORIES.forEach((cat, idx) => {
//     datasets[idx].label = cat
//     bigLabels.forEach((setResLabel, idy) => {
//       datasets[idx].data.push(bigObj[setResLabel].pureCats[cat])
//     })
//   })

//   return { labels: bigLabels, datasets }
// }

// function dataTradesPerSetBarChart(bigObj) {
//   const bigLabels = Object.keys(bigObj).sort()
//   const labels = bigLabels.map(l => l.replace('Results', ''))
//   const datasets = []

//   bigLabels.forEach((tradeSet, idx) => {
//     datasets.push(bigObj[tradeSet].rs.length)
//   })

//   return {
//     labels, datasets: [{
//       label: 'Trades per dataset', data: datasets
//     }]
//   }
// }

// function dataWinRatePerSetBarChart(bigObj) {
//   const bigLabels = Object.keys(bigObj).sort()
//   const labels = bigLabels.map(l => l.replace('Results', ''))
//   const datasets = []

//   bigLabels.forEach((tradeSet, idx) => {
//     datasets.push(bigObj[tradeSet].winRate)
//   })

//   return {
//     labels, datasets: [{
//       label: 'Win rate per set in %', data: datasets
//     }]
//   }
// }

// function dataEfficiencyPerSetBarChart(bigObj) {
//   const bigLabels = Object.keys(bigObj).sort()
//   const labels = bigLabels.map(l => l.replace('Results', ''))
//   const datasets = []

//   bigLabels.forEach((tradeSet, idx) => {
//     datasets.push(((bigObj[tradeSet].pureCats["Category 1"] / bigObj[tradeSet].rs.length) * 100).toFixed(2))
//   })

//   return {
//     labels, datasets: [{
//       label: 'Efficiency Per Set in %', data: datasets
//     }]
//   }
// }

// function dataPieChartTradeCategoryInSet(catsInPercent) {
//   return { labels: Object.keys(catsInPercent), datasets: [{ data: Object.values(catsInPercent) }] }
// }

// function generatePieChartsOfTradeCatPerSetForAll(bigObj) {
//   return Object.keys(bigObj).reduce((accum, currentVal) => {
//     return { ...accum, [currentVal]: dataPieChartTradeCategoryInSet(bigObj[currentVal].cats) }
//   }, {})
// }


// const winRatePerSetLink = await swapLinks(
//   generateBarChart(
//     dataWinRatePerSetBarChart(ObjToAnalyze),
//     'Win Rate per Set in %'
//   )
// )
// console.log('Win rate per set link', winRatePerSetLink)

// const numberOfTradesPerDatasetLinks = await swapLinks(
//   generateBarChart(
//     dataTradesPerSetBarChart(ObjToAnalyze),
//     'Trades per dataset'
//   )
// )
// console.log('Number of trades per set link', numberOfTradesPerDatasetLinks)

// const setEfficientyLinks = await swapLinks(
//   generateBarChart(
//     dataEfficiencyPerSetBarChart(ObjToAnalyze), 'Efficiency Rate per Set in %'
//   )
// )
// console.log('Efficiency per set', setEfficientyLinks)

// const comparisonTradeCatPerSet = await swapLinks(
//   generateBarChart(dataForBarChartResultsComparison(ObjToAnalyze), 'Comparison Trade Category per Set')
// )
// console.log('Comparison of Trade Cat per set', comparisonTradeCatPerSet)

// // Getting pie charts of cats per trade set
// const pieChartsForSets = generatePieChartsOfTradeCatPerSetForAll(ObjToAnalyze)
// const pieChartsOfCatsPerSet = Object.keys(pieChartsForSets).map((tradeSet) => generatePieChart(pieChartsForSets[tradeSet], tradeSet.toString()))

// const pieChartsOfCatsPerSetLinks = await Promise.all(pieChartsOfCatsPerSet.map((link) => swapLinks(link)))

// console.log('Pie Charts of categories per set', pieChartsOfCatsPerSetLinks)

// // show best trades per set

// Object.keys(ObjToAnalyze).sort().forEach((tradeSet) => {
//   console.log(`\n${tradeSet}\n`)
//   console.table(ObjToAnalyze[tradeSet].bestTrades, ['name', 'link', 'entryTime', 'strategy'])
//   console.log('\n\n')
// })

// list of all best trades.

function listAllBestTrades(bigObj) {
  const sets = Object.keys(bigObj).sort()
  return sets.reduce(
    (accum, cV) =>
      accum.concat(bigObj[cV].bestTrades)
    , [])
}

console.log('#### Best Trades ####')
console.table(listAllBestTrades(ObjToAnalyze), ['name', 'link', 'entryTime', 'strategy'])
// // show worst trades per set

// Object.keys(ObjToAnalyze).sort().forEach((tradeSet) => {
//   console.log(`\n${tradeSet}\n`)
//   console.table(ObjToAnalyze[tradeSet].worstTrades, ['name', 'link', 'entryTime', 'strategy'])
//   console.log('\n\n')
// })

