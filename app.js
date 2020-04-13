const express = require('express'),
  path = require('path'),
  dotenvconf = require('dotenv').config(),
  app = express(),
  api = require('covidapi')

if(dotenvconf.error || !process.env.NODE_ENV || !process.env.HTTP_PORT || !process.env.SESSION_SECRET){
  console.error('invalid environment variables, please fix your .env file')
  process.exit(-1)
}

const isProduction = process.env.NODE_ENV === 'production'

app.set('views', path.join(__dirname, '/views'))
app.set('view engine', 'ejs')

app.use(require('morgan')(':date[web] | :remote-addr - :method :url :status :response-time ms - :res[content-length]'))
app.use(require('cookie-parser')())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(require('express-session')({ name: 'coviddetail-session', secret: process.env.SESSION_SECRET, cookie: { maxAge: parseInt(process.env.MAX_COOKIE_AGE) || 36e5 }, resave: false, saveUninitialized: true, httpOnly: true }))
app.use(express.static(path.join(__dirname, '/public')))
app.use(require('helmet')())

app.get('/', (req, res, next) => res.redirect('/global'))

app.get('/:country', async (req, res, next) => { 
  const { country } = req.params
  let countries = (await api.countries({sort:'cases'})),
      data = country.toLowerCase() === 'global' ? (await api.all()) : (await api.countries({country})),
      yesterday = country.toLowerCase() === 'global' ? (await api.yesterday.all()) : (await api.yesterday.countries({country}))
  !data.country && (data.country = 'Global')
  data["countries"] = countries
  data["todayRecovered"] = data.recovered - yesterday.recovered
  data["todayActive"] = data.active - yesterday.active
  data["activeP"] = parseFloat((data.active / data.cases * 100)).toFixed(2)
  data["recoveredP"] = parseFloat((data.recovered / data.cases * 100)).toFixed(2)
  data["deathsP"] = (100 - data.activeP - data.recoveredP).toFixed(2)
  data["infoHtml"] = 
  `<table>
    <tbody>
      <tr>
        <td>Active</td>
        <td>${String(data.active).replace(/(.)(?=(\d{3})+$)/g,'$1,')}</td>
        <td class=${(data.todayActive >= 0 ? 'red':'green')}>${(data.todayActive >= 0 ? "+":"-")+String(data.todayActive).replace(/(.)(?=(\d{3})+$)/g,'$1,')}</td>
      </tr>
      <tr>
        <td>Recovered</td>
        <td>${String(data.recovered).replace(/(.)(?=(\d{3})+$)/g,'$1,')}</td>
        <td class=${(data.todayRecovered >= 0 ? 'green':'red')}>${(data.todayRecovered >= 0 ? "+":"-")+String(data.todayRecovered).replace(/(.)(?=(\d{3})+$)/g,'$1,')}</td>
      </tr>
      <tr>
        <td>Deaths</td>
        <td>${String(data.deaths).replace(/(.)(?=(\d{3})+$)/g,'$1,')}</td>
        <td class=${(data.todayDeaths >= 0 ? 'red':'green')}>${(data.todayDeaths >= 0 ? "+":"-")+String(data.todayDeaths).replace(/(.)(?=(\d{3})+$)/g,'$1,')}</td>
      </tr>
    </tbody>
  </table>`
  res.render('overview', data)
})

app.use((err, req, res, next) => {
  console.error(new Date().toISOString(), err)
  res.locals.message = err.message
  res.locals.error = !isProduction ? err : {}
  res.status(err.status || 5e2).send({ error: err.message })
})

app.listen(process.env.HTTP_PORT, () => console.log(`listening on port ${process.env.HTTP_PORT}`))