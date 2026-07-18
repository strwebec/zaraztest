'use client';

import { useParams } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';
import type { Locale } from '@/lib/i18n';

type Section = { heading: string; body: string };
type Part = { partTitle: string; sections: Section[] };
type PageContent = { title: string; effectiveDate: string; disclaimer: string; parts: Part[] };

const CONTENT: Record<Locale, PageContent> = {
  uk: {
    title: 'Політика конфіденційності та Умови користування ZARAZ',
    effectiveDate: 'Редакція від 12.07.2026',
    disclaimer:
      'ЦЕЙ ДОКУМЕНТ Є ЧЕРНЕТКОЮ, ПІДГОТОВАНОЮ ЗА ДОПОМОГОЮ ШІ, А НЕ ЮРИДИЧНОЮ КОНСУЛЬТАЦІЄЮ. Він написаний з орієнтацією на чинне законодавство України (посилання на конкретні закони наведені нижче), але перед публічним запуском Сервісу та фактичним збором персональних даних користувачів цей документ обов\'язково має перевірити й затвердити кваліфікований адвокат або юрист, знайомий із специфікою вашого бізнесу, фактичною схемою обробки даних, місцем розташування серверів та платіжних провайдерів. Автор цього документа не є учасником Єдиного реєстру адвокатів України і не несе відповідальності за юридичні наслідки його використання без професійної перевірки.',
    parts: [
      {
        partTitle: 'Частина A. Політика конфіденційності',
        sections: [
          {
            heading: 'A.1. Загальні положення та розпорядник даних',
            body:
              'Ця Політика конфіденційності (далі — «Політика») визначає порядок збору, обробки, зберігання, використання та захисту персональних даних фізичних осіб — користувачів онлайн-платформи ZARAZ (далі — «Сервіс», «ми»), доступної через вебсайт та застосунок. Розпорядником та володільцем персональних даних у розумінні Закону України «Про захист персональних даних» № 2297-VI від 01.06.2010 (зі змінами) є юридична особа — оператор Сервісу (реквізити зазначаються в розділі «Контакти» цього документа та/або в реквізитах для оплати комісії в кабінеті бізнесу). Реєструючись у Сервісі, користувач підтверджує, що ознайомився з цією Політикою та Умовами користування (Частина B), розуміє їх зміст і надає свою добровільну, конкретну, поінформовану згоду на обробку персональних даних на умовах, викладених нижче.',
          },
          {
            heading: 'A.2. Терміни та визначення',
            body:
              'У цій Політиці терміни вживаються у значеннях, наведених у Законі України «Про захист персональних даних»: «персональні дані» — відомості чи сукупність відомостей про фізичну особу, яка ідентифікована або може бути конкретно ідентифікована; «обробка персональних даних» — будь-яка дія або сукупність дій, здійснених повністю або частково в інформаційній (автоматизованій) системі та/або в картотеках персональних даних, які пов\'язані зі збиранням, реєстрацією, накопиченням, зберіганням, адаптуванням, зміною, поновленням, використанням і поширенням (розповсюдженням, реалізацією, передачею), знеособленням, знищенням відомостей про фізичну особу; «суб\'єкт персональних даних» — фізична особа, персональні дані якої обробляються; «згода суб\'єкта персональних даних» — добровільне волевиявлення фізичної особи щодо надання дозволу на обробку її персональних даних відповідно до сформульованої мети їх обробки.',
          },
          {
            heading: 'A.3. Правові підстави обробки персональних даних',
            body:
              'Обробка персональних даних здійснюється на таких правових підставах: (а) згода суб\'єкта персональних даних, надана під час реєстрації шляхом проставлення відповідної позначки у формі реєстрації; (б) необхідність виконання договору, стороною якого є суб\'єкт персональних даних, зокрема договору про надання доступу до функціоналу бронювання послуг (публічна оферта, викладена в Частині B цього документа); (в) необхідність виконання обов\'язку, який передбачений законом для розпорядника даних, зокрема обов\'язків податкового та бухгалтерського обліку операцій; (г) законний інтерес розпорядника даних або третьої особи, якому не суперечать інтереси чи основоположні права суб\'єкта персональних даних, зокрема — запобігання шахрайству та захист безпеки Сервісу.',
          },
          {
            heading: 'A.4. Категорії персональних даних, які ми обробляємо',
            body:
              'Для акаунтів клієнтів: ім\'я, номер телефону, електронна пошта, місто, історія бронювань та відвідувань, відгуки, рейтинг користувача та історія його порушень (пізні скасування, неявки), файли аватара. Для бізнес-акаунтів: усе вищевказане для власника акаунту, а також назва бізнесу, юридичні/платіжні реквізити, адреса, категорія послуг, фотографії закладу та персоналу, інформація про майстрів (ім\'я, спеціалізація, графік роботи), файли квитанцій про оплату комісії та TOP-розміщення. Технічні дані: IP-адреса, дата й час звернень до Сервісу — обробляються автоматично засобами захисту від зловживань (обмеження частоти запитів) і не використовуються для профілювання користувачів у маркетингових цілях.',
          },
          {
            heading: 'A.5. Мета обробки персональних даних',
            body:
              'Персональні дані обробляються виключно для таких цілей: реєстрація та автентифікація користувача; надання функціоналу пошуку та бронювання послуг; обмін інформацією про бронювання між клієнтом і бізнесом (включно з номером телефону клієнта, який розкривається бізнесу за обмежений час до початку запису — див. окремі правила в Частині B); нарахування та адміністрування комісії Сервісу, виставлення рахунків бізнес-акаунтам і контроль за їх оплатою; надсилання сповіщень у кабінеті користувача та на електронну пошту про статус бронювань, рахунків і TOP-розміщення; модерація відгуків з метою запобігання образливому чи недостовірному контенту; запобігання шахрайству, зловживанням та порушенням Умов користування; виконання вимог законодавства України, зокрема податкового.',
          },
          {
            heading: 'A.6. Джерела отримання персональних даних',
            body:
              'Персональні дані отримуються безпосередньо від суб\'єкта персональних даних під час реєстрації, заповнення профілю, здійснення бронювання, залишення відгуку або завантаження файлів (аватар, фото закладу, квитанції про оплату). Сервіс не купує та не отримує персональні дані користувачів від третіх осіб без правових підстав.',
          },
          {
            heading: 'A.7. Передача персональних даних третім особам',
            body:
              'Персональні дані можуть передаватися: (а) іншому користувачеві Сервісу в обсязі, необхідному для виконання бронювання (наприклад, ім\'я та телефон клієнта — бізнесу, у якого здійснено бронювання); (б) постачальникам технічних послуг, які забезпечують функціонування Сервісу (хостинг-провайдер, провайдер електронної пошти для надсилання сповіщень, провайдер SMS-повідомлень за наявності), з якими укладено договори, що передбачають обов\'язок дотримання конфіденційності та належного захисту даних; (в) державним органам — виключно на підставі та в порядку, передбачених законодавством України (зокрема на запит правоохоронних органів у межах кримінального провадження). Сервіс не передає та не продає персональні дані користувачів третім особам для їх власних маркетингових цілей.',
          },
          {
            heading: 'A.8. Строки зберігання персональних даних',
            body:
              'Персональні дані зберігаються протягом строку дії акаунту користувача. Після видалення акаунту дані видаляються або знеособлюються протягом розумного строку, необхідного для технічної обробки запиту, за винятком випадків, коли законодавство України (зокрема податкове та бухгалтерське) вимагає зберігання окремих категорій даних (наприклад, даних про фінансові операції та виставлені рахунки) протягом установленого законом строку — зазвичай не менше строку, передбаченого Податковим кодексом України для зберігання первинних документів. Дані про порушення (пізні скасування, неявки), що впливають на рейтинг користувача, зберігаються протягом строку, необхідного для функціонування системи запобігання зловживанням, але не довше 3 років з моменту останнього порушення.',
          },
          {
            heading: 'A.9. Права суб\'єкта персональних даних',
            body:
              'Відповідно до статті 8 Закону України «Про захист персональних даних», користувач має право: знати про джерела збирання, місцезнаходження своїх персональних даних, мету їх обробки; отримувати інформацію про умови надання доступу до персональних даних, зокрема інформацію про третіх осіб, яким передаються його дані; на доступ до своїх персональних даних; отримувати не пізніш як за тридцять календарних днів з дня надходження запиту відповідь про те, чи обробляються його персональні дані; пред\'являти вмотивовану вимогу щодо зміни або знищення своїх персональних даних будь-яким розпорядником, якщо ці дані обробляються незаконно чи є недостовірними; на захист своїх персональних даних від незаконної обробки та випадкової втрати, знищення, пошкодження; звертатися зі скаргами на обробку своїх персональних даних до Уповноваженого Верховної Ради України з прав людини або до суду. Реалізація права на видалення даних може бути обмежена в частині даних, обробка яких необхідна для виконання договірних або законодавчо встановлених зобов\'язань (зокрема, непогашених фінансових зобов\'язань перед Сервісом).',
          },
          {
            heading: 'A.10. Файли cookie та подібні технології',
            body:
              'Сервіс використовує технічно необхідні файли cookie та подібні технології (наприклад, локальне сховище браузера) для збереження стану автентифікації користувача, обраної мови інтерфейсу та інших налаштувань, необхідних для коректної роботи Сервісу. Ці технології не використовуються для рекламного відстеження користувачів на сторонніх сайтах.',
          },
          {
            heading: 'A.11. Вік користувачів',
            body:
              'Сервіс призначений для осіб, які досягли 16-річного віку. Реєструючись, користувач підтверджує, що йому виповнилося щонайменше 16 років. Якщо Сервісу стане відомо про обробку персональних даних особи, яка не досягла зазначеного віку, без згоди її батьків або законних представників, такі дані буде видалено.',
          },
          {
            heading: 'A.12. Заходи безпеки персональних даних',
            body:
              'Сервіс вживає організаційних та технічних заходів для захисту персональних даних від несанкціонованого доступу, зміни, розкриття або знищення, зокрема: шифрування паролів користувачів, обмеження частоти запитів для запобігання перебору облікових даних (rate limiting), розмежування прав доступу до даних відповідно до ролі користувача в системі (клієнт, бізнес, модератор, фінансовий адміністратор, супер-адміністратор), а також маскування номера телефону клієнта в кабінеті бізнесу до настання визначеного часу перед записом.',
          },
          {
            heading: 'A.13. Зміни до цієї Політики',
            body:
              'Сервіс залишає за собою право вносити зміни до цієї Політики. У разі суттєвих змін, що впливають на обсяг чи мету обробки персональних даних, користувачів буде повідомлено через сповіщення в кабінеті користувача та/або на електронну пошту не пізніш як за 14 днів до набрання змінами чинності. Продовження користування Сервісом після набрання чинності змінами вважається згодою користувача з оновленою редакцією Політики.',
          },
          {
            heading: 'A.14. Контакти з питань обробки персональних даних',
            body:
              'З питань, пов\'язаних з обробкою персональних даних та цією Політикою, зокрема для реалізації прав, передбачених розділом A.9, користувач може звернутися за контактними даними, зазначеними на офіційному вебсайті Сервісу, або в кабінеті адміністратора Сервісу.',
          },
        ],
      },
      {
        partTitle: 'Частина B. Умови користування (публічна оферта)',
        sections: [
          {
            heading: 'B.1. Загальні положення та прийняття Умов',
            body:
              'Ці Умови користування (далі — «Умови») є публічною офертою відповідно до статті 641 Цивільного кодексу України та регулюють відносини між Сервісом і будь-якою фізичною чи юридичною особою, яка користується Сервісом як клієнт або як бізнес-акаунт (далі разом — «Користувач»). Реєстрація в Сервісі та проставлення відповідної позначки про згоду означає повне та безумовне прийняття (акцепт) цих Умов у порядку статті 642 Цивільного кодексу України.',
          },
          {
            heading: 'B.2. Терміни',
            body:
              '«Клієнт» — фізична особа, яка використовує Сервіс для пошуку та бронювання послуг бізнесів, зареєстрованих у каталозі. «Бізнес» / «Бізнес-акаунт» — фізична особа-підприємець або юридична особа, яка зареєструвала в Сервісі профіль для надання своїх послуг і прийому бронювань через Сервіс. «Каталог» — публічний перелік бізнесів та їхніх послуг, доступний для перегляду й пошуку клієнтами. «Бронювання» — запис клієнта на послугу бізнесу, здійснений через Сервіс. «TOP-розміщення» — платна послуга підвищення видимості профілю бізнесу в Каталозі.',
          },
          {
            heading: 'B.3. Реєстрація та акаунт користувача',
            body:
              'Для користування функціоналом бронювання необхідна реєстрація акаунту із зазначенням достовірних персональних даних. Користувач зобов\'язаний не розголошувати пароль від свого акаунту третім особам і несе самостійну відповідальність за всі дії, вчинені під його обліковим записом. Бізнес-акаунт після реєстрації набуває статусу «На розгляді» й стає видимим у Каталозі лише після підтвердження адміністратором Сервісу; Сервіс залишає за собою право відхилити заявку на реєстрацію бізнес-акаунту без пояснення причин, зокрема у разі підозри на недостовірність наданих відомостей.',
          },
          {
            heading: 'B.4. Права та обов\'язки клієнта',
            body:
              'Клієнт має право переглядати Каталог, здійснювати бронювання послуг, скасовувати або переносити бронювання відповідно до політики скасування, встановленої конкретним бізнесом (від 12 до 48 годин до початку запису), залишати відгуки про відвідані заклади, додавати заклади до обраного. Клієнт зобов\'язаний вказувати достовірні контактні дані під час бронювання, з\'являтися на заброньовані записи або своєчасно їх скасовувати, а також утримуватися від зловживання функціоналом бронювання (зокрема — множинних безпідставних бронювань з наміром їх не виконувати).',
          },
          {
            heading: 'B.5. Права та обов\'язки бізнес-акаунта',
            body:
              'Бізнес має право після підтвердження акаунту адміністратором: вказувати перелік своїх послуг, ціни та тривалість; додавати майстрів (персонал) і закріплювати графік їхньої роботи; приймати бронювання клієнтів через Сервіс та створювати ручні записи безпосередньо в календарі; переглядати статистику й аналітику своєї діяльності; купувати послугу TOP-розміщення. Бізнес зобов\'язаний вказувати достовірну інформацію про себе та свої послуги, вчасно оновлювати графік роботи (щоб уникнути прийому бронювань у неробочий час), не скасовувати підтверджені бронювання без поважних причин, а також вчасно сплачувати комісію Сервісу відповідно до розділу B.8 цих Умов.',
          },
          {
            heading: 'B.6. Порядок бронювання, скасування та перенесення',
            body:
              'Бронювання вважається підтвердженим одразу після успішного оформлення через Сервіс і резервує обраний часовий слот у майстра бізнесу — подвійне бронювання одного слота технічно унеможливлюється. Клієнт може скасувати або перенести бронювання через свій кабінет; якщо це відбувається пізніше встановленої бізнесом межі (12–48 годин до початку запису — конкретне значення зазначається в кабінеті бронювання), скасування вважається пізнім і фіксується як порушення. Бізнес також може скасувати підтверджене бронювання; у такому разі клієнту надсилається запит підтвердити, чи скасування відбулося на його прохання, і від відповіді залежить, чи зараховується це скасування бізнесу як необґрунтоване (див. B.7).',
          },
          {
            heading: 'B.7. Система рейтингу та штрафних санкцій',
            body:
              'З метою підтримання дисципліни бронювань Сервіс веде облік порушень з боку клієнтів і бізнесів. Пізнє скасування або перенесення клієнтом знижує його внутрішній рейтинг на 1 бал і тимчасово обмежує можливість нового бронювання на 48 годин; неявка на підтверджений запис знижує рейтинг на 2 бали з аналогічним тимчасовим обмеженням. У разі накопичення трьох послідовних порушень строк обмеження подовжується до 7 днів, а у разі п\'яти — акаунт клієнта передається на розгляд адміністрації Сервісу. Аналогічно, для бізнесів, які без згоди клієнта необґрунтовано скасовують підтверджені бронювання, ведеться окремий облік: після трьох таких випадків бізнес отримує попередження від адміністрації, після шести — тимчасове зниження позиції в результатах пошуку Каталогу, після дев\'яти — акаунт передається на розгляд адміністрації Сервісу.',
          },
          {
            heading: 'B.8. Комісія Сервісу',
            body:
              'Використання функціоналу бронювання бізнес-акаунтом є платним у формі комісії з вартості кожної наданої послуги. Стандартна ставка комісії становить 2% від вартості послуги для бронювань, здійснених клієнтом через Сервіс («платформні» бронювання), та 1% для бронювань, внесених бізнесом вручну через власний кабінет («ручні» бронювання). ПРОМО-УМОВА: для кожного бізнес-акаунту протягом перших 6 (шести) календарних місяців з моменту успішної реєстрації комісія становить 0% незалежно від типу бронювання; після завершення цього шестимісячного пільгового періоду застосовується стандартна ставка комісії, зазначена вище, автоматично та без необхідності додаткових дій з боку бізнесу. Актуальний статус пільгового періоду відображається в кабінеті бізнесу в розділі «Рахунки». Сервіс залишає за собою право змінювати розмір стандартної комісії на майбутні періоди, повідомивши про це бізнес-акаунти не менш як за 30 днів.',
          },
          {
            heading: 'B.9. Рахунки, порядок оплати та наслідки прострочення',
            body:
              'Нарахована комісія формується в рахунок щомісяця; строк оплати зазначається безпосередньо в рахунку в кабінеті бізнесу. Оплата здійснюється за реквізитами, вказаними адміністрацією Сервісу, з подальшим завантаженням підтвердження оплати (квитанції) через кабінет бізнесу. У разі несплати рахунку в установлений строк Сервіс залишає за собою право обмежити відображення профілю бізнесу в Каталозі; у разі продовження прострочення понад 11 днів з моменту виставлення рахунку статус заборгованості змінюється на прострочений з надсиланням попередження, а по завершенні 14 днів — профіль бізнесу блокується повністю до погашення заборгованості, без відшкодування вартості вже наданих послуг просування. Якщо заборгованість не погашається протягом розумного строку після блокування, Сервіс залишає за собою право: (а) нарахувати проценти за прострочення грошового зобов\'язання відповідно до статті 625 Цивільного кодексу України; (б) звернутися до суду в порядку, передбаченому Цивільним процесуальним кодексом України; (в) передати інформацію про заборгованість колекторській компанії або факторинговій установі відповідно до чинного законодавства України.',
          },
          {
            heading: 'B.10. Подання недостовірного підтвердження оплати',
            body:
              'Подання Сервісу підробленої, зміненої або іншим чином недостовірної квитанції про оплату (в тому числі відредагованої у графічному редакторі) з метою уникнення оплати комісії або отримання TOP-розміщення без фактичної оплати розцінюється як спроба шахрайства. У такому випадку Сервіс залишає за собою право заблокувати акаунт без попередження та звернутися до правоохоронних органів із заявою про вчинення кримінального правопорушення, передбаченого статтею 190 («Шахрайство») та/або статтею 358 («Підроблення документів») Кримінального кодексу України.',
          },
          {
            heading: 'B.11. TOP-розміщення',
            body:
              'Бізнес-акаунт може придбати платну послугу TOP-розміщення строком на 1 тиждень, 2 тижні або 1 місяць, вартість якої зазначена в кабінеті бізнесу. Заявка на TOP-розміщення розглядається адміністратором Сервісу після надходження оплати за реквізитами, вказаними адміністрацією; розміщення активується автоматично протягом 15 хвилин після підтвердження оплати адміністратором. TOP-розміщення підвищує позицію бізнесу в результатах пошуку Каталогу відповідно до внутрішнього алгоритму ранжування (заклади з рейтингом 5.0 відображаються першими незалежно від наявності TOP-розміщення) і не гарантує певної кількості бронювань чи переглядів профілю.',
          },
          {
            heading: 'B.12. Відгуки та модерація контенту',
            body:
              'Клієнт може залишити відгук про бізнес лише після фактично завершеного бронювання. Відгуки, що містять ненормативну лексику чи інші заборонені слова, автоматично надсилаються на модерацію адміністратору Сервісу перед публікацією. Бізнес має право публічно відповісти на відгук у межах свого профілю. Заборонено публікувати відгуки, що містять завідомо недостовірну інформацію, персональні дані третіх осіб, рекламу сторонніх послуг або мову ворожнечі.',
          },
          {
            heading: 'B.13. Заборонена поведінка',
            body:
              'Користувачам забороняється: використовувати Сервіс для будь-якої незаконної діяльності; здійснювати спроби несанкціонованого доступу до облікових записів інших користувачів або до інфраструктури Сервісу; використовувати автоматизовані засоби (боти, скрипти) для масового створення акаунтів чи бронювань; надавати завідомо недостовірні дані про себе або свій бізнес; здійснювати дії, спрямовані на обхід системи нарахування комісії; розповсюджувати шкідливе програмне забезпечення. Порушення цього розділу є підставою для негайного блокування акаунту без попередження та, за наявності ознак кримінального правопорушення, — звернення до правоохоронних органів.',
          },
          {
            heading: 'B.14. Роль Сервісу та обмеження відповідальності',
            body:
              'Сервіс є інформаційним посередником (маркетплейсом), який надає технічну можливість клієнтам і бізнесам знаходити один одного та узгоджувати час надання послуг. Договір про фактичне надання послуги (наприклад, манікюру чи стрижки) укладається безпосередньо між клієнтом і бізнесом; Сервіс не є стороною цього договору, не гарантує якості послуг, що надаються бізнесами, і не несе відповідальності за шкоду, заподіяну під час чи внаслідок надання такої послуги. Відповідальність за достовірність інформації в профілі бізнесу (адреса, ціни, наявні послуги) несе виключно відповідний бізнес-акаунт. Сервіс не несе відповідальності за тимчасову недоступність через технічні роботи, збої на боці третіх постачальників послуг (хостинг, електронна пошта) або обставини непереборної сили. Якщо персональні дані користувачів буде розкрито внаслідок несанкціонованого доступу до інфраструктури Сервісу (кібератака, злам, витік із боку третіх постачальників технічних послуг), окремий бізнес-акаунт, профіль якого розміщено на платформі, не несе відповідальності за такий інцидент — за умови, що витік стався не з його вини (наприклад, унаслідок розголошення ним власних облікових даних третім особам). Реагування на інциденти безпеки та повідомлення постраждалих осіб і компетентних органів у випадках, передбачених законодавством України, є обов\'язком розпорядника даних Сервісу відповідно до розділу A.12; це положення не є повним звільненням розпорядника даних від відповідальності, передбаченої законодавством України про захист персональних даних.',
          },
          {
            heading: 'B.15. Інтелектуальна власність',
            body:
              'Усі права на дизайн, програмний код, торговельну марку та інші об\'єкти інтелектуальної власності Сервісу належать його правовласнику й охороняються відповідно до Цивільного кодексу України та Закону України «Про авторське право і суміжні права». Завантажуючи фотографії або інший контент у свій профіль, користувач гарантує, що має необхідні права на такий контент, і надає Сервісу невиключну безоплатну ліцензію на його використання виключно в межах функціонування Каталогу.',
          },
          {
            heading: 'B.16. Порядок вирішення спорів',
            body:
              'Усі спори, що виникають у зв\'язку з цими Умовами, вирішуються шляхом переговорів. У разі недосягнення згоди протягом 30 днів спір передається на розгляд до суду за місцезнаходженням відповідача відповідно до законодавства України, якщо інше прямо не передбачено чинним законодавством (зокрема Законом України «Про захист прав споживачів» щодо підсудності спорів за участю клієнта-споживача).',
          },
          {
            heading: 'B.17. Форс-мажор',
            body:
              'Сторони звільняються від відповідальності за часткове або повне невиконання зобов\'язань за цими Умовами, якщо таке невиконання стало наслідком обставин непереборної сили, що виникли після прийняття Умов і які сторона не могла ні передбачити, ні відвернути розумними заходами (war, стихійне лихо, дії органів влади, збої глобальної мережевої інфраструктури тощо), що підтверджується в порядку, встановленому законодавством України, зокрема сертифікатом Торгово-промислової палати України.',
          },
          {
            heading: 'B.18. Зміни до Умов і припинення дії акаунту',
            body:
              'Сервіс залишає за собою право вносити зміни до цих Умов у порядку, аналогічному розділу A.13 цього документа. Користувач має право видалити свій акаунт у будь-який момент, звернувшись до адміністрації Сервісу, за умови відсутності непогашених фінансових зобов\'язань. Сервіс має право заблокувати або видалити акаунт користувача в разі порушення цих Умов у порядку, описаному у відповідних розділах вище.',
          },
          {
            heading: 'B.19. Прикінцеві положення',
            body:
              'Ці Умови та Політика конфіденційності регулюються та тлумачаться відповідно до законодавства України. Якщо будь-яке положення цих Умов буде визнано недійсним чи таким, що не підлягає примусовому виконанню, це не впливає на чинність решти положень.',
          },
        ],
      },
    ],
  },
  en: {
    title: 'ZARAZ Privacy Policy & Terms of Use',
    effectiveDate: 'Revision dated 12.07.2026',
    disclaimer:
      'THIS DOCUMENT IS AN AI-ASSISTED DRAFT, NOT LEGAL ADVICE. It has been written with reference to applicable Ukrainian legislation (specific laws are cited below), but before the public launch of the Service and any actual collection of user personal data, this document must be reviewed and approved by a qualified, licensed advocate familiar with your specific business, the actual data-processing setup, server locations, and payment providers. The author of this document is not a member of the Unified Register of Advocates of Ukraine and is not liable for legal consequences arising from its use without professional review.',
    parts: [
      {
        partTitle: 'Part A. Privacy Policy',
        sections: [
          {
            heading: 'A.1. General provisions and data controller',
            body:
              'This Privacy Policy ("Policy") governs the collection, processing, storage, use, and protection of personal data of individuals who use the ZARAZ online platform ("Service", "we"), accessible via the website and app. The data controller under the Law of Ukraine "On Personal Data Protection" No. 2297-VI of 01.06.2010 (as amended) is the legal entity operating the Service (details are listed in the "Contact" section below and/or in the commission payment details in the business dashboard). By registering, the user confirms they have read this Policy and the Terms of Use (Part B), understand their content, and give voluntary, specific, informed consent to the processing of personal data on the terms set out below.',
          },
          {
            heading: 'A.2. Definitions',
            body:
              'Terms in this Policy are used in the meanings given in the Law of Ukraine "On Personal Data Protection": "personal data" — information or a set of information about an identified or identifiable natural person; "processing of personal data" — any action or set of actions performed on personal data, including collection, registration, accumulation, storage, adaptation, alteration, renewal, use and dissemination, depersonalization, and destruction; "data subject" — the natural person whose data is processed; "consent of the data subject" — a voluntary expression of will by the individual to permit processing of their personal data for a stated purpose.',
          },
          {
            heading: 'A.3. Legal bases for processing',
            body:
              'Personal data is processed on the following legal bases: (a) the data subject\'s consent, given at registration by checking the relevant box; (b) necessity for performance of a contract to which the data subject is a party, namely the agreement to access the booking functionality (the public offer set out in Part B); (c) necessity to comply with a legal obligation applicable to the controller, in particular tax and accounting record-keeping; (d) the legitimate interest of the controller or a third party, provided it does not override the data subject\'s fundamental rights — in particular, fraud prevention and Service security.',
          },
          {
            heading: 'A.4. Categories of personal data we process',
            body:
              'For client accounts: name, phone number, email, city, booking and visit history, reviews, the user\'s internal rating and violation history (late cancellations, no-shows), avatar files. For business accounts: all of the above for the account owner, plus business name, billing details, address, service category, photos of the venue and staff, staff information (name, specialization, schedule), and receipt files for commission and TOP-placement payments. Technical data: IP address, timestamps of requests to the Service — processed automatically by abuse-prevention mechanisms (rate limiting) and not used for marketing profiling.',
          },
          {
            heading: 'A.5. Purpose of processing',
            body:
              'Personal data is processed exclusively for: account registration and authentication; providing search and booking functionality; exchanging booking information between client and business (including the client\'s phone number, revealed to the business a limited time before the appointment — see Part B); calculating and administering the Service commission, issuing invoices to business accounts and tracking payment; sending in-app and email notifications about booking, invoice, and TOP-placement status; moderating reviews to prevent abusive or false content; preventing fraud, abuse, and violations of the Terms of Use; complying with Ukrainian legislation, including tax law.',
          },
          {
            heading: 'A.6. Sources of personal data',
            body:
              'Personal data is obtained directly from the data subject during registration, profile completion, booking, leaving a review, or uploading files (avatar, venue photos, payment receipts). The Service does not purchase or otherwise obtain user personal data from third parties without a lawful basis.',
          },
          {
            heading: 'A.7. Disclosure to third parties',
            body:
              'Personal data may be shared: (a) with another Service user to the extent necessary to fulfil a booking (e.g., the client\'s name and phone to the business they booked with); (b) with technical service providers that keep the Service running (hosting provider, email delivery provider, SMS provider if used), under agreements requiring confidentiality and adequate data protection; (c) with state authorities — only on the grounds and in the manner provided by Ukrainian law (e.g., a law-enforcement request within criminal proceedings). The Service does not sell or transfer user personal data to third parties for their own marketing purposes.',
          },
          {
            heading: 'A.8. Data retention periods',
            body:
              'Personal data is retained for the lifetime of the user\'s account. After account deletion, data is deleted or anonymized within a reasonable technical processing period, except where Ukrainian law (in particular tax and accounting law) requires retention of certain data categories (e.g., financial transaction and invoice data) for the statutory period generally set by the Tax Code of Ukraine for primary documents. Violation records (late cancellations, no-shows) affecting a user\'s rating are kept for as long as necessary for abuse-prevention purposes, but no longer than 3 years from the last violation.',
          },
          {
            heading: 'A.9. Rights of the data subject',
            body:
              'Under Article 8 of the Law of Ukraine "On Personal Data Protection", users have the right to: know the sources of collection and the location of their personal data and the purpose of processing; obtain information on the conditions of access to their data, including third parties to whom it is disclosed; access their own personal data; receive a response, no later than thirty calendar days from the request, on whether their data is being processed; make a reasoned demand to change or destroy their data if it is processed unlawfully or is inaccurate; protection of their data from unlawful processing and accidental loss, destruction, or damage; lodge complaints about the processing of their data with the Ukrainian Parliament Commissioner for Human Rights or with a court. The right to deletion may be limited for data whose processing is necessary to fulfil contractual or statutory obligations (including outstanding financial obligations to the Service).',
          },
          {
            heading: 'A.10. Cookies and similar technologies',
            body:
              'The Service uses technically necessary cookies and similar technologies (e.g., browser local storage) to maintain the user\'s authentication state, chosen interface language, and other settings required for the Service to function correctly. These technologies are not used for advertising tracking of users on third-party sites.',
          },
          {
            heading: 'A.11. Age of users',
            body:
              'The Service is intended for individuals aged 16 and over. By registering, the user confirms they are at least 16 years old. If the Service becomes aware that it is processing the personal data of a person under this age without parental or guardian consent, such data will be deleted.',
          },
          {
            heading: 'A.12. Security measures',
            body:
              'The Service applies organizational and technical measures to protect personal data against unauthorized access, alteration, disclosure, or destruction, including: password hashing, rate limiting to prevent credential-stuffing, role-based access control (client, business, moderator, finance admin, super admin), and masking the client\'s phone number in the business dashboard until a defined time before the appointment.',
          },
          {
            heading: 'A.13. Changes to this Policy',
            body:
              'The Service reserves the right to amend this Policy. Material changes affecting the scope or purpose of processing will be communicated via an in-app notification and/or email at least 14 days before they take effect. Continued use of the Service after the changes take effect constitutes acceptance of the updated Policy.',
          },
          {
            heading: 'A.14. Contact for data protection matters',
            body:
              'For questions related to personal data processing and this Policy, including exercising the rights described in section A.9, users may use the contact details published on the Service\'s official website or in the Service administrator dashboard.',
          },
        ],
      },
      {
        partTitle: 'Part B. Terms of Use (public offer)',
        sections: [
          {
            heading: 'B.1. General provisions and acceptance',
            body:
              'These Terms of Use ("Terms") constitute a public offer under Article 641 of the Civil Code of Ukraine and govern the relationship between the Service and any individual or legal entity using the Service as a client or business account (together, "User"). Registering with the Service and checking the relevant consent box constitutes full and unconditional acceptance of these Terms under Article 642 of the Civil Code of Ukraine.',
          },
          {
            heading: 'B.2. Definitions',
            body:
              '"Client" — an individual using the Service to find and book services from businesses listed in the catalog. "Business" / "Business account" — a sole proprietor or legal entity that has registered a profile with the Service to offer its services and accept bookings. "Catalog" — the public listing of businesses and their services available for browsing and search. "Booking" — a client\'s appointment with a business, made through the Service. "TOP placement" — a paid service that boosts a business profile\'s visibility in the Catalog.',
          },
          {
            heading: 'B.3. Registration and user account',
            body:
              'Using the booking functionality requires registering an account with accurate personal data. Users must not disclose their password to third parties and are solely responsible for all actions taken under their account. After registration, a business account has "Pending" status and becomes visible in the Catalog only after approval by a Service administrator; the Service reserves the right to reject a business registration application without explanation, in particular where the submitted information appears inaccurate.',
          },
          {
            heading: 'B.4. Client rights and obligations',
            body:
              'A client may browse the Catalog, book services, cancel or reschedule bookings in accordance with the specific business\'s cancellation policy (12 to 48 hours before the appointment), leave reviews for visited venues, and add venues to favorites. A client must provide accurate contact details when booking, show up for confirmed appointments or cancel them in time, and refrain from abusing the booking functionality (including repeated groundless bookings with no intent to attend).',
          },
          {
            heading: 'B.5. Business account rights and obligations',
            body:
              'Once approved, a business may: list its services, prices, and durations; add staff and set their schedules; accept client bookings through the Service and create manual bookings directly in its calendar; view its own statistics and analytics; purchase TOP placement. A business must provide accurate information about itself and its services, keep its working hours up to date (to avoid accepting bookings outside working hours), avoid cancelling confirmed bookings without good reason, and pay the Service commission on time under section B.8.',
          },
          {
            heading: 'B.6. Booking, cancellation, and rescheduling',
            body:
              'A booking is confirmed as soon as it is successfully placed through the Service and reserves the chosen time slot with the business\'s staff member — double-booking the same slot is technically prevented. A client may cancel or reschedule a booking from their dashboard; if this happens later than the business\'s stated cutoff (12–48 hours before the appointment, shown at booking time), the cancellation is treated as late and recorded as a violation. A business may also cancel a confirmed booking; in that case the client is asked to confirm whether the cancellation was at their own request, and the answer determines whether it counts as an unfair cancellation by the business (see B.7).',
          },
          {
            heading: 'B.7. Rating and penalty system',
            body:
              'To maintain booking discipline, the Service tracks violations by both clients and businesses. A late cancellation or reschedule by a client lowers their internal rating by 1 point and temporarily restricts new bookings for 48 hours; a no-show lowers the rating by 2 points with the same temporary restriction. After three consecutive violations the restriction period extends to 7 days, and after five the client\'s account is referred for administrative review. Similarly, for businesses that cancel confirmed bookings without the client\'s consent and without good reason, a separate count is kept: after three such cases the business receives a warning, after six its Catalog search ranking is temporarily lowered, and after nine the account is referred for administrative review.',
          },
          {
            heading: 'B.8. Service commission',
            body:
              'Using the booking functionality on a business account is subject to a commission on the value of each service rendered. The standard commission rate is 2% of the service price for bookings made by a client through the Service ("platform" bookings) and 1% for bookings entered manually by the business in its own dashboard ("manual" bookings). PROMOTIONAL TERM: for each business account, commission is 0% for the first 6 (six) calendar months from successful registration, regardless of booking type; once that six-month grace period ends, the standard commission rate above applies automatically, with no action required from the business. The current status of the grace period is shown in the business dashboard, in the "Invoices" section. The Service reserves the right to change the standard commission rate for future periods, giving business accounts at least 30 days\' notice.',
          },
          {
            heading: 'B.9. Invoices, payment, and consequences of non-payment',
            body:
              'Accrued commission is compiled into a monthly invoice; the payment deadline is stated directly on the invoice in the business dashboard. Payment is made to the details specified by the Service administration, followed by uploading proof of payment (a receipt) through the business dashboard. If an invoice is not paid by its deadline, the Service reserves the right to restrict the business profile\'s visibility in the Catalog; if the delay continues beyond 11 days from issuance the debt status changes to overdue with a warning sent, and after 14 days the business profile is fully blocked until the debt is settled, without reimbursement for promotion services already rendered. If the debt remains unpaid for a reasonable period after blocking, the Service reserves the right to: (a) charge late-payment interest under Article 625 of the Civil Code of Ukraine; (b) pursue recovery through the courts under the Civil Procedure Code of Ukraine; (c) transfer the debt information to a collection agency or factoring company in accordance with applicable law.',
          },
          {
            heading: 'B.10. Submitting a false proof of payment',
            body:
              'Submitting a falsified, altered, or otherwise inauthentic payment receipt to the Service (including one edited in an image editor) to avoid paying commission or to obtain TOP placement without actual payment is considered an attempt at fraud. In such cases, the Service reserves the right to block the account without prior notice and report the matter to law enforcement as a criminal offense under Article 190 ("Fraud") and/or Article 358 ("Forgery of documents") of the Criminal Code of Ukraine.',
          },
          {
            heading: 'B.11. TOP placement',
            body:
              'A business account may purchase TOP placement for 1 week, 2 weeks, or 1 month, at the price shown in the business dashboard. A TOP placement request is reviewed by a Service administrator after payment is received to the details provided by the administration; placement activates automatically within 15 minutes of the administrator confirming payment. TOP placement improves a business\'s position in Catalog search results according to the internal ranking algorithm (5.0-rated venues are always shown first regardless of TOP status) and does not guarantee any specific number of bookings or profile views.',
          },
          {
            heading: 'B.12. Reviews and content moderation',
            body:
              'A client may leave a review for a business only after a booking has actually been completed. Reviews containing profanity or other prohibited words are automatically sent for administrator moderation before publication. A business may publicly reply to a review on its profile. It is prohibited to publish reviews containing knowingly false information, third parties\' personal data, advertising of unrelated services, or hate speech.',
          },
          {
            heading: 'B.13. Prohibited conduct',
            body:
              'Users may not: use the Service for any unlawful activity; attempt unauthorized access to other users\' accounts or to the Service\'s infrastructure; use automated tools (bots, scripts) for mass account creation or bookings; provide knowingly false information about themselves or their business; take actions aimed at circumventing the commission system; distribute malicious software. Violating this section is grounds for immediate account suspension without notice and, where a criminal offense is indicated, a report to law enforcement.',
          },
          {
            heading: 'B.14. Role of the Service and limitation of liability',
            body:
              'The Service is an information intermediary (marketplace) that provides the technical means for clients and businesses to find each other and arrange service times. The contract for the actual provision of a service (e.g., a manicure or haircut) is concluded directly between the client and the business; the Service is not a party to that contract, does not guarantee the quality of services provided by businesses, and is not liable for damage arising from or during such services. Responsibility for the accuracy of information in a business profile (address, prices, services offered) rests solely with that business account. The Service is not liable for temporary unavailability due to maintenance, failures on the side of third-party providers (hosting, email), or force majeure. If user personal data is exposed as a result of unauthorized access to the Service\'s own infrastructure (a cyberattack, hack, or a data leak caused by a third-party hosting or other technical provider), an individual business account listed on the platform bears no liability for that incident, provided the leak was not caused by that account\'s own fault (for example, by disclosing its own login credentials to third parties). Responding to security incidents and notifying affected individuals and the competent authorities where required by Ukrainian law remains the responsibility of the Service\'s data controller under Section A.12; this clause is not a blanket release of the data controller from liability under Ukrainian personal-data-protection law.',
          },
          {
            heading: 'B.15. Intellectual property',
            body:
              'All rights to the Service\'s design, source code, trademark, and other intellectual property belong to its rightholder and are protected under the Civil Code of Ukraine and the Law of Ukraine "On Copyright and Related Rights". By uploading photos or other content to their profile, a user warrants they hold the necessary rights to such content and grants the Service a non-exclusive, royalty-free license to use it solely within the operation of the Catalog.',
          },
          {
            heading: 'B.16. Dispute resolution',
            body:
              'Any disputes arising in connection with these Terms are resolved through negotiation. If no agreement is reached within 30 days, the dispute is referred to a court at the defendant\'s location under Ukrainian law, unless applicable law provides otherwise (in particular the Law of Ukraine "On Consumer Rights Protection" regarding jurisdiction over disputes involving a client-consumer).',
          },
          {
            heading: 'B.17. Force majeure',
            body:
              'The parties are released from liability for partial or complete failure to perform obligations under these Terms if such failure results from force majeure circumstances arising after acceptance of the Terms that a party could not reasonably foresee or prevent (war, natural disaster, actions of public authorities, global network infrastructure failures, etc.), confirmed in the manner established by Ukrainian law, in particular by a certificate of the Ukrainian Chamber of Commerce and Industry.',
          },
          {
            heading: 'B.18. Changes to the Terms and account termination',
            body:
              'The Service reserves the right to amend these Terms in the manner analogous to section A.13 of this document. A user may delete their account at any time by contacting the Service administration, provided there are no outstanding financial obligations. The Service may suspend or delete a user\'s account for violating these Terms, in the manner described in the relevant sections above.',
          },
          {
            heading: 'B.19. Final provisions',
            body:
              'These Terms and the Privacy Policy are governed by and construed in accordance with the law of Ukraine. If any provision of these Terms is found invalid or unenforceable, this does not affect the validity of the remaining provisions.',
          },
        ],
      },
    ],
  },
};

export default function PrivacyPolicyPage() {
  const { locale } = useParams<{ locale: Locale }>();
  const content = CONTENT[locale] ?? CONTENT.uk;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text">{content.title}</h1>
        <p className="text-xs font-medium text-text-muted">{content.effectiveDate}</p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning shadow-sm">
        <TriangleAlert size={18} className="mt-0.5 shrink-0" />
        <span>{content.disclaimer}</span>
      </div>

      {content.parts.map((part) => (
        <div key={part.partTitle} className="flex flex-col gap-5">
          <h2 className="border-b border-border pb-2 font-display text-lg font-bold text-text">{part.partTitle}</h2>
          {part.sections.map((s) => (
            <section key={s.heading} className="flex flex-col gap-1.5">
              <h3 className="text-sm font-bold text-text">{s.heading}</h3>
              <p className="text-sm leading-relaxed text-text-muted">{s.body}</p>
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}
