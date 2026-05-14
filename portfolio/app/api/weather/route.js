export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') || 'Seoul'
  try {
    // Open-Meteo (free, no API key needed)
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ko&format=json`)
    const geoData = await geo.json()
    if (!geoData.results?.length) return Response.json({ error: '도시를 찾을 수 없습니다' }, { status: 404 })
    const { latitude, longitude, name, country } = geoData.results[0]
    const weather = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&timezone=auto`)
    const wData = await weather.json()
    const cur = wData.current
    const codeMap = { 0:'맑음',1:'대체로 맑음',2:'약간 흐림',3:'흐림',45:'안개',48:'안개',51:'가벼운 이슬비',61:'비',71:'눈',80:'소나기',95:'뇌우' }
    const desc = codeMap[cur.weathercode] || '알 수 없음'
    return Response.json({ name, country, temp: Math.round(cur.temperature_2m), desc, wind: cur.windspeed_10m, humidity: cur.relative_humidity_2m })
  } catch(e) {
    return Response.json({ error: '날씨 데이터를 가져올 수 없습니다' }, { status: 500 })
  }
}
