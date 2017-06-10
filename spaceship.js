var canvas = document.createElement('canvas');
var ctx = canvas.getContext("2d");
document.body.appendChild(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function isVisible(obj) {
  return obj.x > -40 && obj.x < canvas.width + 40 &&
    obj.y > -40 && obj.y < canvas.height + 40;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function paintStars(stars) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  stars.forEach(function(star) {
    ctx.fillRect(star.x, star.y, star.size, star.size);
  });
}

function gameOver(ship, enemies) {
  return enemies.some(enemy => {
    if (collision(ship, enemy)) {
      return true;
    }
    return enemy.shots.some(shot => collision(ship, shot));
  });
}

function checkGameOver(ship, enemies) {
  let over = gameOver(ship,enemies);
  if (over) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px sans-serif';
    ctx.fillText('You Lost', canvas.height/2, canvas.width/2 - 50);
  }
  return over;
}

function collision(target1, target2) {
  return (target1.x > target2.x - 20 && target1.x < target2.x + 20) &&
         (target1.y > target2.y - 20 && target1.y < target2.y + 20);
}

function paintScore(score) {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('Score: ' + score, 40, 43);
}

function drawTriangle(x, y, width, color, direction) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - width, y);
  ctx.lineTo(x, direction === 'up' ? y - width : y + width);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x - width,y);
  ctx.fill();
}

function paintSpaceShip(x, y) {
  drawTriangle(x, y, 20, '#ff0000', 'up');
}
let horization = true, counter = 1, down = false, left = true, c = 1;
function paintEnemies(enemies) {
  enemies.forEach(function(enemy) {
    if (enemy.y > canvas.height/5) {
      if (horization && counter % 20 > 0) {
        if (left && c < 20) {
          enemy.x += 5;
          c++;
        }
        if (!left && c < 20) {
          enemy.x -= 5;
          c++;
        }
        if (c == 20) {
          c = 1;
          left = !left;
        }
        counter++;
        horization = counter % 20;
        down = !horization;
      }
      else if (down && counter % 20 > 0) {
        enemy.y += 3;
        counter++;
        down = counter % 20;
        horization = !down;
      } else if (counter % 20 === 0) counter++;
    } else enemy.y += 5;
    if (!enemy.isDead) {
      drawTriangle(enemy.x, enemy.y, 20, '#00ff00', 'down');
    }

    enemy.shots.forEach(function(shot) {
      shot.y += SHOOTING_SPEED;
      drawTriangle(shot.x, shot.y, 5, '#00ffff', 'down');
    });
  });
}

const ScoreSubject = new Rx.BehaviorSubject(0);
const SHOOTING_SPEED = 15, SCORE_INCREASE= 15;
function paintHeroShots(heroShots, enemies) {
  heroShots.forEach(shot => {
    let enemies_length = enemies ? enemies.length : 0;
    for (let i = 0; i < enemies_length; i++) {
      const enemy = enemies[i];
      if (!enemy.isDead && collision(shot, enemy)) {
        ScoreSubject.next(SCORE_INCREASE);
        enemy.isDead = true;
        shot.x = shot.y = -100;
        break;
      }
    }
    shot.y -= SHOOTING_SPEED;
    drawTriangle(shot.x, shot.y, 5, '#ffff00', 'up');
  });
}

const SPEED = 40, STAR_NUMBER = 250;
const StarStream = Rx.Observable.range(1, STAR_NUMBER)
  .map(() => {
    return {
      x: parseInt(Math.random() * canvas.width),
      y: parseInt(Math.random() * canvas.height),
      size: Math.random() * 3 + 1
    };
  })  
  .toArray()
  .flatMap(starArray => {
    return Rx.Observable.interval(SPEED).map(() => {
      starArray.forEach(star => {
        if (star.y >= canvas.height) {
          star.y = 0;
        }
        star.y += 3;
      });
      return starArray;
    });
  })/*.subscribe(stars => paintStars(stars))*/;

const HERO_Y = canvas.height - 30;
const SpaceShip = Rx.Observable.fromEvent(canvas, 'mousemove')
  .map(event => { return { x: event.clientX, y: HERO_Y }; })
  .startWith({ x: canvas.width / 2, y: HERO_Y })/*.subscribe(pos => paintSpaceShip(pos.x, pos.y))*/;

function isVisible(obj) {
  return obj.x > -40 && obj.x < canvas.width + 40 &&
    obj.y > -40 && obj.y < canvas.height + 40;
}

const ENEMY_FREQ = 1500, ENEMY_SHOOTING_FREQ = 750;
const Enemies = Rx.Observable.interval(ENEMY_FREQ)
  .scan(enemyArray => {
    let enemy = {
      x: parseInt(Math.random() * canvas.width),
      y: -30,
      shots: []
    };

    Rx.Observable.interval(ENEMY_SHOOTING_FREQ).subscribe(() => {
      if (!enemy.isDead) {
        enemy.shots.push({ x: enemy.x, y: enemy.y });
        enemy.shots = enemy.shots.filter(isVisible);
      }
    });
    enemyArray.push(enemy);
    return enemyArray.filter(isVisible).filter(enemy => !(enemy.isDead && enemy.shots.length === 0));
  }, [])/*.subscribe(enemies => paintEnemies(enemies))*/;

const playerFiring = Rx.Observable
  .merge(
    Rx.Observable.fromEvent(canvas, 'click'),
    Rx.Observable.fromEvent(canvas, 'keydown').filter(evt => evt.keycode === 32)
  )
  .sampleTime(200)
  .timestamp();

const HeroShots = Rx.Observable
  .combineLatest(
    playerFiring,
    SpaceShip,
    (shotEvents, spaceShip) => {
      return {
        timestamp: shotEvents.timestamp,
        x: spaceShip.x
      };
    })
  .distinctUntilChanged((a, b) => a.timestamp === b.timestamp)
  .scan((shotArray, shot) => {
    shotArray.push({ x:shot.x, y: HERO_Y });
    return shotArray;
  }, []).map(shotArray => shotArray.filter(shot => shot.y > 0))
  /*.subscribe(shots => paintHeroShots(shots))*/;
  /*Rx.Observable.combineLatest(Rx.Observable.interval(SPEED), 
    HeroShots).subscribe(value => paintHeroShots(value[1]));*/

const Score = ScoreSubject.scan((prev, cur) => prev + cur, 0).startWith(0);

function renderScene(actors) {
  paintStars(actors.stars);
  paintSpaceShip(actors.spaceship.x, actors.spaceship.y);
  paintEnemies(actors.enemies);
  paintHeroShots(actors.heroShots, actors.enemies);
  paintScore(actors.score);
}

Rx.Observable.combineLatest(
    StarStream, SpaceShip, HeroShots, Enemies, Score,
    function(stars, spaceship, heroShots, enemies, score) {
      return {
        stars: stars,
        spaceship: spaceship,
        enemies: enemies,
        heroShots: heroShots,
        score: score
      };
    })
  .sampleTime(SPEED)
  .takeWhile(function(actors) {
    return checkGameOver(actors.spaceship, actors.enemies) === false;
  })
  .subscribe(renderScene);